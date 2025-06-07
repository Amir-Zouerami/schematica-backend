const path = require('path');
const fs = require('fs/promises');
const config = require('../config');

const usersDBPath = path.join(__dirname, '..', '..', 'app_data', 'users', 'users-db.json');

const getProjectMetaPath = projectId => path.join(config.projectsPath, `${projectId}.meta.json`);
const getProjectOpenApiPath = projectId => path.join(config.projectsPath, `${projectId}.openapi.json`);

const readUsersDB = async () => {
	try {
		const jsonData = await fs.readFile(usersDBPath, 'utf-8');
		return JSON.parse(jsonData);
	} catch (error) {
		console.error('Error reading users-db.json:', error);

		if (error.code === 'ENOENT') {
			return [];
		}

		throw error;
	}
};

const writeUsersDB = async data => {
	try {
		await fs.writeFile(usersDBPath, JSON.stringify(data, null, 2), 'utf-8');
		console.log('users-db.json has been updated.');
	} catch (error) {
		console.error('Error writing to users-db.json:', error);
		throw error;
	}
};

const readOpenApiFile = async projectId => {
	const filePath = getProjectOpenApiPath(projectId);

	try {
		const content = await fs.readFile(filePath, 'utf-8');
		return JSON.parse(content);
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error('OpenAPI file not found.');
		}
		throw new Error('Could not read or parse OpenAPI file.');
	}
};

const writeOpenApiFile = async (projectId, specData) => {
	const filePath = getProjectOpenApiPath(projectId);
	await fs.writeFile(filePath, JSON.stringify(specData, null, 2));
};

const findProjectByName = async nameToFind => {
	try {
		const files = await fs.readdir(config.projectsPath);
		const metaFiles = files.filter(file => {
			return file.endsWith('.meta.json');
		});

		for (const metaFile of metaFiles) {
			const filePath = path.join(config.projectsPath, metaFile);

			try {
				const content = await fs.readFile(filePath, 'utf-8');
				const project = JSON.parse(content);

				if (project.name.toLowerCase() === nameToFind.toLowerCase()) {
					return project;
				}
			} catch (e) {
				console.warn(`Could not read or parse project metadata file ${metaFile} during name check: ${e.message}`);
			}
		}
	} catch (e) {
		console.error(`Error reading projects directory for name check: ${e.message}`);
		throw e;
	}
	return null;
};

module.exports = {
	readUsersDB,
	writeUsersDB,
	readOpenApiFile,
	writeOpenApiFile,
	findProjectByName,
	getProjectMetaPath,
	getProjectOpenApiPath,
};
