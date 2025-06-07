const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const { v4: uuidv4 } = require('uuid');
const { inlineAllComponents } = require('../utils/openApiInlineUtils');

const {
	readUsersDB,
	findProjectByName,
	readOpenApiFile,
	writeOpenApiFile,
	getProjectMetaPath,
	getProjectOpenApiPath,
} = require('../utils/general');

const createProject = async (req, res) => {
	try {
		const { name, description, serverUrl, links } = req.body;
		const userId = req.user.id;

		if (!name || typeof name !== 'string' || name.trim() === '') {
			return res.status(400).json({ message: 'Project name is required and must be a non-empty string.' });
		}

		const trimmedName = name.trim();
		const existingProject = await findProjectByName(trimmedName);

		if (existingProject) {
			return res.status(409).json({ message: `A project with the name "${trimmedName}" already exists.` });
		}

		const projectId = uuidv4();
		const now = new Date().toISOString();

		const usersDB = await readUsersDB();
		const creator = usersDB.find(user => user.id === userId);
		const creatorUsername = creator ? creator.username : 'Unknown User';

		const projectMetadata = {
			id: projectId,
			name: trimmedName,
			description: description || '',
			serverUrl: serverUrl || '',
			links: links || [],
			createdBy: creatorUsername,
			createdAt: now,
			updatedAt: now,
		};

		const initialOpenApiSpec = {
			openapi: '3.0.0',
			info: { title: trimmedName, version: '1.0.0', description: description || `API documentation for ${trimmedName}` },
			servers: serverUrl ? [{ url: serverUrl }] : [],
			paths: {},
			components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
		};

		const metaFilePath = getProjectMetaPath(projectId);
		const openApiFilePath = getProjectOpenApiPath(projectId);

		await fs.writeFile(metaFilePath, JSON.stringify(projectMetadata, null, 2));
		await fs.writeFile(openApiFilePath, JSON.stringify(initialOpenApiSpec, null, 2));

		console.log(`Project created: ${projectId} ('${trimmedName}') by user ${creatorUsername} (ID: ${userId}).`, {
			actor: req.user.username,
		});

		res.status(201).json(projectMetadata);
	} catch (error) {
		console.error('Error creating project:', error);

		if (error.message.includes('projects directory')) {
			res.status(500).json({ message: 'Server configuration error: Cannot access projects storage.', error: error.message });
		} else {
			res.status(500).json({ message: 'Failed to create project', error: error.message });
		}
	}
};

const getProjects = async (_req, res) => {
	try {
		const files = await fs.readdir(config.projectsPath);

		const projectPromises = files
			.filter(file => file.endsWith('.meta.json'))
			.map(async file => {
				const filePath = path.join(config.projectsPath, file);

				try {
					const content = await fs.readFile(filePath, 'utf-8');
					const d = JSON.parse(content);

					return {
						id: d.id,
						name: d.name,
						description: d.description || '',
						serverUrl: d.serverUrl || '',
						links: d.links || [],
						createdBy: d.createdBy,
						createdAt: d.createdAt,
						updatedAt: d.updatedAt,
					};
				} catch (e) {
					console.warn(`Could not read or parse project metadata file ${file}: ${e.message}`);
					return null;
				}
			});

		const projects = (await Promise.all(projectPromises)).filter(p => p !== null);
		projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		res.json(projects);
	} catch (error) {
		console.error('Error listing projects:', error);

		if (error.code === 'ENOENT' && error.path === config.projectsPath) {
			console.warn('Projects directory not found, returning empty list.');
			res.json([]);
		} else {
			res.status(500).json({ message: 'Failed to list projects', error: error.message });
		}
	}
};

const updateProject = async (req, res) => {
	const { projectId } = req.params;
	const { name, description, serverUrl, links, lastKnownUpdatedAt } = req.body;

	if (!name || typeof name !== 'string' || name.trim() === '') {
		return res.status(400).json({ message: 'Project name is required and must be a non-empty string.' });
	}

	const trimmedName = name.trim();
	const now = new Date().toISOString();
	const metaFilePath = getProjectMetaPath(projectId);

	try {
		let existingProjectMeta;
		try {
			const content = await fs.readFile(metaFilePath, 'utf-8');
			existingProjectMeta = JSON.parse(content);
		} catch (error) {
			if (error.code === 'ENOENT') {
				return res.status(404).json({ message: 'Project not found.' });
			}
			throw error;
		}

		if (existingProjectMeta.name.toLowerCase() !== trimmedName.toLowerCase()) {
			const projectWithNewName = await findProjectByName(trimmedName);

			if (projectWithNewName && projectWithNewName.id !== projectId) {
				return res.status(409).json({ message: `A project with the name "${trimmedName}" already exists.` });
			}
		}

		if (lastKnownUpdatedAt && existingProjectMeta.updatedAt !== lastKnownUpdatedAt) {
			console.warn(
				`OCC Conflict on project update ${projectId}. Client knew ${lastKnownUpdatedAt}, server has ${existingProjectMeta.updatedAt}`,
			);
			return res.status(409).json({
				message: 'This project has been updated by someone else since you started editing.',
				serverUpdatedAt: existingProjectMeta.updatedAt,
			});
		}

		const updatedProjectMeta = {
			...existingProjectMeta,
			name: trimmedName,
			description: description === undefined ? existingProjectMeta.description : description,
			serverUrl: serverUrl === undefined ? existingProjectMeta.serverUrl : serverUrl,
			links: links === undefined ? existingProjectMeta.links : links,
			updatedAt: now,
		};

		await fs.writeFile(metaFilePath, JSON.stringify(updatedProjectMeta, null, 2));

		if (existingProjectMeta.serverUrl !== updatedProjectMeta.serverUrl || existingProjectMeta.name !== trimmedName) {
			try {
				const spec = await readOpenApiFile(projectId);

				if (
					existingProjectMeta.name !== trimmedName ||
					(description !== undefined && existingProjectMeta.description !== description)
				) {
					spec.info = spec.info || { title: trimmedName, version: '1.0.0' };
					spec.info.title = trimmedName;

					if (description !== undefined) {
						spec.info.description = description || `API documentation for ${trimmedName}`;
					} else if (!spec.info.description) {
						spec.info.description = `API documentation for ${trimmedName}`;
					}
				}

				spec.servers = Array.isArray(spec.servers) ? spec.servers : [];

				if (updatedProjectMeta.serverUrl) {
					if (spec.servers.length > 0) {
						spec.servers[0].url = updatedProjectMeta.serverUrl;
						spec.servers[0].description = spec.servers[0].description || 'Primary server';
					} else {
						spec.servers.push({ url: updatedProjectMeta.serverUrl, description: 'Primary server' });
					}
				} else {
					if (spec.servers.length > 0) {
						spec.servers[0].url = '';
					}
				}

				await writeOpenApiFile(projectId, spec);
				console.log(`OpenAPI spec updated for project ${projectId} due to metadata change.`, { actor: req.user.username });
			} catch (openApiError) {
				console.warn(`Could not update OpenAPI spec for project ${projectId} during metadata update: ${openApiError.message}`, {
					actor: req.user.username,
				});
			}
		}

		console.log(`Project ${projectId} metadata updated.`, { actor: req.user.username });
		res.status(200).json(updatedProjectMeta);
	} catch (error) {
		console.error(`Error updating project ${projectId}:`, { actor: req.user.username }, error);
		res.status(500).json({ message: 'Failed to update project', error: error.message });
	}
};

const deleteProject = async (req, res) => {
	try {
		const { projectId } = req.params;
		if (!projectId) {
			return res.status(400).json({ message: 'Project ID is required.' });
		}

		const metaFilePath = getProjectMetaPath(projectId);
		const openApiFilePath = getProjectOpenApiPath(projectId);
		let projectExists = false;

		try {
			await fs.access(metaFilePath);
			projectExists = true;
		} catch (e) {
			console.error('file does not exist ', e);
		}

		if (!projectExists) {
			return res.status(404).json({ message: 'Project not found.' });
		}

		await fs.rm(metaFilePath, { force: true });
		await fs.rm(openApiFilePath, { force: true });

		console.log(`Project ${projectId} deleted successfully.`, { actor: req.user.username });
		res.status(200).json({ message: 'Project deleted successfully.' });
	} catch (error) {
		console.error(`Error deleting project ${req.params.projectId}:`, { actor: req.user.username }, error);
		res.status(500).json({ message: 'Failed to delete project', error: error.message });
	}
};

const getProjectById = async (req, res) => {
	try {
		const { projectId } = req.params;
		if (!projectId) {
			return res.status(400).json({ message: 'Project ID is required.' });
		}
		const metaFilePath = getProjectMetaPath(projectId);
		try {
			const content = await fs.readFile(metaFilePath, 'utf-8');
			const d = JSON.parse(content);
			res.json({
				id: d.id,
				name: d.name,
				description: d.description || '',
				serverUrl: d.serverUrl || '',
				links: d.links || [],
				createdBy: d.createdBy,
				createdAt: d.createdAt,
				updatedAt: d.updatedAt,
			});
		} catch (error) {
			if (error.code === 'ENOENT') {
				return res.status(404).json({ message: 'Project not found.' });
			}
			throw error;
		}
	} catch (error) {
		console.error(`Error fetching project by ID ${req.params.projectId}:`, error);
		res.status(500).json({ message: 'Failed to fetch project details', error: error.message });
	}
};

const getProjectOpenApiSpec = async (req, res) => {
	try {
		const { projectId } = req.params;
		if (!projectId) {
			return res.status(400).json({ message: 'Project ID is required.' });
		}

		const openApiFilePath = getProjectOpenApiPath(projectId);

		try {
			const content = await fs.readFile(openApiFilePath, 'utf-8');
			const openApiSpec = JSON.parse(content);
			res.json(openApiSpec);
		} catch (error) {
			if (error.code === 'ENOENT') {
				return res.status(404).json({ message: 'OpenAPI specification not found for this project.' });
			}

			console.error(`Error parsing OpenAPI spec for project ID ${projectId}: ${error.message}`);
			return res.status(500).json({ message: 'Failed to parse OpenAPI specification: File may be corrupted.' });
		}
	} catch (error) {
		console.error(`Error fetching OpenAPI spec for project ID ${req.params.projectId}:`, error);
		res.status(500).json({ message: 'Failed to fetch OpenAPI specification', error: error.message });
	}
};

const updateOpenApiSpec = async (req, res) => {
	const { projectId } = req.params;
	const { specData: newSpecDataFromRequest, lastKnownProjectUpdatedAt } = req.body;

	const userPerformingEdit = req.user.username;
	const now = new Date().toISOString();

	if (!newSpecDataFromRequest || typeof newSpecDataFromRequest !== 'object' || !newSpecDataFromRequest.openapi) {
		return res.status(400).json({ message: 'Invalid OpenAPI specification data provided.' });
	}

	try {
		const metaFilePath = getProjectMetaPath(projectId);
		let projectMeta;

		try {
			const metaContent = await fs.readFile(metaFilePath, 'utf-8');
			projectMeta = JSON.parse(metaContent);
		} catch (metaReadError) {
			if (metaReadError.code === 'ENOENT') {
				return res.status(404).json({ message: 'Project metadata not found. Cannot verify version.' });
			}

			console.error(`Error reading project metadata for OCC check (project ${projectId}):`, metaReadError);
			return res.status(500).json({ message: 'Server error: Could not read project metadata for version check.' });
		}

		// --- OPTIMISTIC CONCURRENCY CHECK ---
		if (lastKnownProjectUpdatedAt && projectMeta.updatedAt !== lastKnownProjectUpdatedAt) {
			console.warn(
				`OCC Conflict on full OpenAPI spec update for project ${projectId}. ` +
					`Client knew project version: ${lastKnownProjectUpdatedAt}, Server has: ${projectMeta.updatedAt}`,
				{ actor: userPerformingEdit },
			);

			return res.status(409).json({
				message:
					'The project (including its OpenAPI spec) has been modified by someone else. Please refresh the project data and try your OpenAPI edits again.',
				serverUpdatedAt: projectMeta.updatedAt,
			});
		}

		let finalSpecToProcess = newSpecDataFromRequest;

		if (config.inlineComponentsOnSave === true || String(config.inlineComponentsOnSave).toLowerCase() === 'true') {
			console.log(`[Project: ${projectId}] Inlining components for OpenAPI spec on save.`, { actor: userPerformingEdit });

			finalSpecToProcess = inlineAllComponents(newSpecDataFromRequest);
			finalSpecToProcess.components = {};
		}

		let oldSpec = {};

		try {
			oldSpec = await readOpenApiFile(projectId);
		} catch (e) {
			console.log(`No existing OpenAPI spec found for project ${projectId}, treating as new.`, { actor: userPerformingEdit });
			oldSpec = { openapi: newSpecDataFromRequest.openapi, info: {}, paths: {}, components: {} };
		}

		const mergedPaths = {};
		finalSpecToProcess.paths = finalSpecToProcess.paths || {};

		finalSpecToProcess.info = finalSpecToProcess.info || {
			title: oldSpec.info?.title || projectMeta.name || 'API Documentation',
			version: oldSpec.info?.version || '1.0.0',
			description: oldSpec.info?.description || projectMeta.description || '',
		};

		finalSpecToProcess.components = finalSpecToProcess.components || oldSpec.components || {};

		for (const pathKey in finalSpecToProcess.paths) {
			if (Object.prototype.hasOwnProperty.call(finalSpecToProcess.paths, pathKey)) {
				const newPathItem = finalSpecToProcess.paths[pathKey];
				mergedPaths[pathKey] = {};

				for (const propKey in newPathItem) {
					if (
						!['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'].includes(propKey.toLowerCase()) &&
						Object.prototype.hasOwnProperty.call(newPathItem, propKey)
					) {
						mergedPaths[pathKey][propKey] = newPathItem[propKey];
					}
				}

				for (const methodKey in newPathItem) {
					const lowerMethodKey = methodKey.toLowerCase();

					if (
						Object.prototype.hasOwnProperty.call(newPathItem, methodKey) &&
						['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'].includes(lowerMethodKey)
					) {
						const newOperation = newPathItem[methodKey];
						let existingXAppMetadata = {};

						if (
							oldSpec.paths &&
							oldSpec.paths[pathKey] &&
							oldSpec.paths[pathKey][lowerMethodKey] &&
							oldSpec.paths[pathKey][lowerMethodKey]['x-app-metadata']
						) {
							existingXAppMetadata = oldSpec.paths[pathKey][lowerMethodKey]['x-app-metadata'];
						}

						const mergedXAppMetadata = {
							createdBy: existingXAppMetadata.createdBy || userPerformingEdit,
							createdAt: existingXAppMetadata.createdAt || now,
							lastEditedBy: userPerformingEdit,
							lastEditedAt: now,
							notes: newOperation['x-app-metadata']?.notes || existingXAppMetadata.notes || [],
						};

						mergedPaths[pathKey][lowerMethodKey] = { ...newOperation, 'x-app-metadata': mergedXAppMetadata };
					}
				}
			}
		}

		const finalSpecToWrite = {
			openapi: finalSpecToProcess.openapi,
			info: finalSpecToProcess.info,
			servers: finalSpecToProcess.servers,
			paths: mergedPaths,
			components: finalSpecToProcess.components,
			tags: finalSpecToProcess.tags,
			externalDocs: finalSpecToProcess.externalDocs,
			security: finalSpecToProcess.security,
			...Object.fromEntries(
				Object.entries(finalSpecToProcess).filter(
					([key]) => !['openapi', 'info', 'servers', 'paths', 'components', 'tags', 'externalDocs', 'security'].includes(key),
				),
			),
		};

		await writeOpenApiFile(projectId, finalSpecToWrite);

		projectMeta.updatedAt = now;

		let specServerUrl = '';
		if (Array.isArray(finalSpecToWrite.servers) && finalSpecToWrite.servers.length > 0 && finalSpecToWrite.servers[0].url) {
			specServerUrl = finalSpecToWrite.servers[0].url;
		}

		if (projectMeta.serverUrl !== specServerUrl) {
			projectMeta.serverUrl = specServerUrl;
		}

		if (finalSpecToWrite.info) {
			if (
				(!projectMeta.name || projectMeta.name.trim() === '') &&
				finalSpecToWrite.info.title &&
				finalSpecToWrite.info.title.trim() !== ''
			) {
				projectMeta.name = finalSpecToWrite.info.title.trim();
			}

			if (
				(!projectMeta.description || projectMeta.description.trim() === '') &&
				finalSpecToWrite.info.description &&
				finalSpecToWrite.info.description.trim() !== ''
			) {
				projectMeta.description = finalSpecToWrite.info.description.trim();
			}
		}

		await fs.writeFile(metaFilePath, JSON.stringify(projectMeta, null, 2));

		res.status(200).json({
			message: 'OpenAPI specification updated successfully.',
			data: finalSpecToWrite,
			projectUpdatedAt: projectMeta.updatedAt,
		});
	} catch (error) {
		console.error(`Error updating full OpenAPI spec for project ${projectId}:`, error, { actor: userPerformingEdit });
		res.status(500).json({ message: error.message || 'Failed to update OpenAPI specification.' });
	}
};

const addEndpoint = async (req, res) => {
	const { projectId } = req.params;
	const { path: endpointPath, method: endpointMethod, operation: operationFromRequest } = req.body;
	const userAddingEndpoint = req.user.username;
	const now = new Date().toISOString();

	if (!endpointPath || !endpointMethod || !operationFromRequest) {
		return res.status(400).json({ message: 'Missing required fields: path, method, or operation data.' });
	}
	const lowerMethod = endpointMethod.toLowerCase();

	try {
		const spec = await readOpenApiFile(projectId);
		spec.paths = spec.paths || {};

		if (spec.paths[endpointPath] && spec.paths[endpointPath][lowerMethod]) {
			return res.status(409).json({ message: `Endpoint ${lowerMethod.toUpperCase()} ${endpointPath} already exists.` });
		}

		const operationToSave = {
			...operationFromRequest,
			'x-app-metadata': {
				createdBy: userAddingEndpoint,
				createdAt: now,
				lastEditedBy: userAddingEndpoint,
				lastEditedAt: now,
				notes: operationFromRequest['x-app-metadata']?.notes || [],
			},
		};

		spec.paths[endpointPath] = spec.paths[endpointPath] || {};
		spec.paths[endpointPath][lowerMethod] = operationToSave;

		await writeOpenApiFile(projectId, spec);

		try {
			const metaFilePath = getProjectMetaPath(projectId);
			const metaContent = await fs.readFile(metaFilePath, 'utf-8');
			const projectMeta = JSON.parse(metaContent);
			projectMeta.updatedAt = now;

			await fs.writeFile(metaFilePath, JSON.stringify(projectMeta, null, 2));
		} catch (metaError) {
			console.warn(`Could not update project meta: ${metaError.message}`, { actor: req.user.username });
		}

		console.log(`endpoint ${endpointMethod.toUpperCase()} ${endpointPath} added successfully.`, { actor: req.user.username });
		res.status(201).json({ message: 'Endpoint added successfully.', data: operationToSave });
	} catch (error) {
		console.error(`Error adding endpoint for project ${projectId}:`, error, { actor: req.user.username });
		res.status(500).json({ message: error.message || 'Failed to add endpoint.' });
	}
};

const updateEndpoint = async (req, res) => {
	const { projectId } = req.params;
	const { originalPath, originalMethod, newPath, newMethod, operation: operationFromRequest, lastKnownOperationUpdatedAt } = req.body;
	const userMakingChange = req.user.username;
	const now = new Date().toISOString();

	if (!originalPath || !originalMethod || !newPath || !newMethod || !operationFromRequest) {
		return res.status(400).json({ message: 'Missing required fields for endpoint update.' });
	}

	try {
		const spec = await readOpenApiFile(projectId);
		spec.paths = spec.paths || {};
		const lowerOriginalMethod = originalMethod.toLowerCase();
		const lowerNewMethod = newMethod.toLowerCase();

		if (!spec.paths[originalPath] || !spec.paths[originalPath][lowerOriginalMethod]) {
			return res.status(404).json({ message: `Endpoint ${originalMethod.toUpperCase()} ${originalPath} not found.` });
		}

		const existingOperation = spec.paths[originalPath][lowerOriginalMethod];
		const existingXAppMetadata = existingOperation['x-app-metadata'] || {};

		if (lastKnownOperationUpdatedAt && existingXAppMetadata.lastEditedAt !== lastKnownOperationUpdatedAt) {
			console.warn(
				`OCC Conflict on endpoint update ${projectId} -> ${originalMethod} ${originalPath}. `,
				`Client knew: ${lastKnownOperationUpdatedAt}, Server has: ${existingXAppMetadata.lastEditedAt}`,
				{ actor: req.user.username },
			);

			return res.status(409).json({
				message: 'This endpoint has been updated by someone else since you started editing',
				serverUpdatedAt: existingXAppMetadata.lastEditedAt,
				lastUpdatedBy: existingXAppMetadata.lastEditedBy,
			});
		}

		const operationToSave = {
			...operationFromRequest,
			'x-app-metadata': {
				createdBy: existingXAppMetadata.createdBy || userMakingChange,
				createdAt: existingXAppMetadata.createdAt || now,
				lastEditedBy: userMakingChange,
				lastEditedAt: now,
				notes:
					operationFromRequest['x-app-metadata']?.notes !== undefined
						? operationFromRequest['x-app-metadata'].notes
						: existingXAppMetadata.notes || [],
			},
		};

		if (originalPath !== newPath || lowerOriginalMethod !== lowerNewMethod) {
			if (spec.paths[newPath] && spec.paths[newPath][lowerNewMethod]) {
				if (!(originalPath === newPath && lowerOriginalMethod === lowerNewMethod)) {
					return res.status(409).json({
						message: `Cannot update endpoint. An endpoint already exists at ${newMethod.toUpperCase()} ${newPath}.`,
					});
				}
			}

			delete spec.paths[originalPath][lowerOriginalMethod];

			if (Object.keys(spec.paths[originalPath]).length === 0) {
				delete spec.paths[originalPath];
			}

			spec.paths[newPath] = spec.paths[newPath] || {};
			spec.paths[newPath][lowerNewMethod] = operationToSave;
		} else {
			spec.paths[originalPath][lowerOriginalMethod] = operationToSave;
		}

		await writeOpenApiFile(projectId, spec);

		try {
			const metaFilePath = getProjectMetaPath(projectId);
			const metaContent = await fs.readFile(metaFilePath, 'utf-8');
			const projectMeta = JSON.parse(metaContent);
			projectMeta.updatedAt = now;

			await fs.writeFile(metaFilePath, JSON.stringify(projectMeta, null, 2));
		} catch (metaError) {
			console.warn(`Could not update project meta: ${metaError.message}`, { actor: req.user.username });
		}

		res.status(200).json({ message: 'Endpoint updated successfully.', operation: operationToSave });
	} catch (error) {
		console.error(`Error updating endpoint for project ${projectId}:`, { actor: req.user.username }, error);
		res.status(500).json({ message: error.message || 'Failed to update endpoint.' });
	}
};

const deleteEndpointOperation = async (req, res) => {
	const { projectId } = req.params;
	const { path: endpointPath, method: endpointMethod } = req.body;

	if (!endpointPath || !endpointMethod) {
		return res.status(400).json({ message: 'Endpoint path and method are required for deletion.' });
	}
	const lowerMethod = endpointMethod.toLowerCase();

	try {
		const spec = await readOpenApiFile(projectId);

		if (!spec.paths || !spec.paths[endpointPath] || !spec.paths[endpointPath][lowerMethod]) {
			return res.status(404).json({ message: `Endpoint ${lowerMethod.toUpperCase()} ${endpointPath} not found.` });
		}

		delete spec.paths[endpointPath][lowerMethod];

		if (Object.keys(spec.paths[endpointPath]).length === 0) {
			delete spec.paths[endpointPath];
		}

		await writeOpenApiFile(projectId, spec);

		const now = new Date().toISOString();
		try {
			const metaFilePath = getProjectMetaPath(projectId);
			const metaContent = await fs.readFile(metaFilePath, 'utf-8');
			const projectMeta = JSON.parse(metaContent);
			projectMeta.updatedAt = now;
			await fs.writeFile(metaFilePath, JSON.stringify(projectMeta, null, 2));
		} catch (metaError) {
			console.warn(
				`Could not update project metadata updatedAt timestamp for ${projectId} after deleting endpoint: ${metaError.message}`,
				{
					actor: req.user.username,
				},
			);
		}

		console.log(`endpoint ${endpointMethod.toUpperCase()} ${endpointPath} deleted successfully.`, { actor: req.user.username });
		res.status(200).json({ message: `Endpoint ${lowerMethod.toUpperCase()} ${endpointPath} deleted successfully.` });
	} catch (error) {
		console.error(
			`Error deleting endpoint ${lowerMethod} ${endpointPath} for project ${projectId}:`,
			{ actor: req.user.username },
			error,
		);
		res.status(500).json({ message: error.message || 'Failed to delete endpoint.' });
	}
};

const addEndpointNote = async (req, res) => {
	const { projectId, methodPlusPath } = req.params;
	const { content: noteContent } = req.body;
	const userAddingNote = req.user.username;

	if (!noteContent || typeof noteContent !== 'string' || noteContent.trim() === '') {
		return res.status(400).json({ message: 'Note content is required.' });
	}

	const firstSlashIndex = methodPlusPath.indexOf('/');
	if (firstSlashIndex === -1 || firstSlashIndex === 0 || firstSlashIndex === methodPlusPath.length - 1) {
		return res.status(400).json({ message: 'Invalid endpoint format in URL. Expected :method/:path (e.g., get/api/users)' });
	}
	const method = methodPlusPath.substring(0, firstSlashIndex).toLowerCase();
	const path = '/' + methodPlusPath.substring(firstSlashIndex + 1);

	try {
		const spec = await readOpenApiFile(projectId);
		if (!spec.paths || !spec.paths[path] || !spec.paths[path][method]) {
			return res.status(404).json({ message: `Endpoint ${method.toUpperCase()} ${path} not found.` });
		}

		const endpointOperation = spec.paths[path][method];
		endpointOperation['x-app-metadata'] = endpointOperation['x-app-metadata'] || {
			createdBy: 'unknown',
			createdAt: new Date().toISOString(),
			notes: [],
		};

		endpointOperation['x-app-metadata'].notes = endpointOperation['x-app-metadata'].notes || [];

		const newNote = {
			content: noteContent.trim(),
			createdBy: userAddingNote,
			createdAt: new Date().toISOString(),
		};

		endpointOperation['x-app-metadata'].notes.push(newNote);

		await writeOpenApiFile(projectId, spec);

		console.log(`Note for ${method.toUpperCase()} ${path} added successfully.`, { actor: req.user.username });
		res.status(201).json(newNote);
	} catch (error) {
		console.error(`Error adding note to endpoint ${method} ${path} for project ${projectId}:`, { actor: req.user.username }, error);
		res.status(500).json({ message: error.message || 'Failed to add note.' });
	}
};

const deleteEndpointNote = async (req, res) => {
	const { projectId, methodPlusPath, noteIndex: noteIndexStr } = req.params;

	const noteIndex = parseInt(noteIndexStr, 10);
	if (isNaN(noteIndex) || noteIndex < 0) {
		return res.status(400).json({ message: 'Invalid note index.' });
	}

	const firstSlashIndex = methodPlusPath.indexOf('/');
	if (firstSlashIndex === -1 || firstSlashIndex === 0 || firstSlashIndex === methodPlusPath.length - 1) {
		return res.status(400).json({ message: 'Invalid endpoint format in URL.' });
	}

	const method = methodPlusPath.substring(0, firstSlashIndex).toLowerCase();
	const path = '/' + methodPlusPath.substring(firstSlashIndex + 1);

	try {
		const spec = await readOpenApiFile(projectId);
		if (!spec.paths || !spec.paths[path] || !spec.paths[path][method]) {
			return res.status(404).json({ message: `Endpoint ${method.toUpperCase()} ${path} not found.` });
		}

		const endpointOperation = spec.paths[path][method];
		if (
			!endpointOperation['x-app-metadata'] ||
			!endpointOperation['x-app-metadata'].notes ||
			noteIndex >= endpointOperation['x-app-metadata'].notes.length
		) {
			return res.status(404).json({ message: 'Note not found at the specified index.' });
		}

		const noteToDelete = endpointOperation['x-app-metadata'].notes[noteIndex];
		if (req.user.role === 'client' && noteToDelete.createdBy !== req.user.username) {
			console.warn(`unauthorized attempt to delete note!`, { actor: req.user.username });
			return res.status(403).json({ message: 'Forbidden: You can only delete your own notes.' });
		}

		endpointOperation['x-app-metadata'].notes.splice(noteIndex, 1);

		await writeOpenApiFile(projectId, spec);
		console.log(`Note for ${method.toUpperCase()} ${path} successfully deleted.`, {
			actor: req.user.username,
			owner: noteToDelete.createdBy,
		});

		res.status(200).json({ message: 'Note deleted successfully.' });
	} catch (error) {
		console.error(`Error deleting note from endpoint ${method} ${path} for project ${projectId}:`, error);
		res.status(500).json({ message: error.message || 'Failed to delete note.' });
	}
};

module.exports = {
	createProject,
	getProjects,
	deleteProject,
	getProjectById,
	updateProject,
	getProjectOpenApiSpec,
	updateOpenApiSpec,
	addEndpoint,
	updateEndpoint,
	deleteEndpointOperation,
	addEndpointNote,
	deleteEndpointNote,
};
