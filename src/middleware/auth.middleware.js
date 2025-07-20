const jwt = require('jsonwebtoken');
const config = require('../config');
const { readUsersDB, getProjectMetaPath, userIsProjectOwner } = require('../utils/general');
const fs = require('fs').promises;

const authenticateToken = async (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	const usersDB = await readUsersDB();

	if (token === null) {
		console.log('Auth middleware: No token provided');
		return res.status(401).json({ message: 'No token provided' });
	}

	jwt.verify(token, config.jwtSecret, (err, decodedJwtPayload) => {
		if (err) {
			console.log('Auth middleware: Token verification failed', err.message);
			return res.status(403).json({ message: 'Token is not valid' });
		}

		const userFromToken = usersDB.find(u => u.id === decodedJwtPayload.userId);
		if (!userFromToken) {
			console.log('Auth middleware: User from token not found');
			return res.status(403).json({ message: 'User not found for token' });
		}

		// eslint-disable-next-line
		const { password, ...userWithoutPassword } = userFromToken;
		req.user = userWithoutPassword;
		next();
	});
};

const authorizeProjectOwner = async (req, res, next) => {
	try {
		const { projectId } = req.params;

		if (!projectId) {
			return res.status(400).json({ message: 'Project ID is missing from request.' });
		}

		const metaFilePath = getProjectMetaPath(projectId);
		const metaContent = await fs.readFile(metaFilePath, 'utf-8');
		const projectMeta = JSON.parse(metaContent);

		if (userIsProjectOwner(req.user, projectMeta)) {
			req.projectMeta = projectMeta;
			next();
		} else {
			res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
		}
	} catch (error) {
		if (error.code === 'ENOENT') {
			res.status(404).json({ message: 'Project not found.' });
		} else {
			console.error('Error in authorizeProjectOwner middleware:', error);
			res.status(500).json({ message: 'Server error during authorization.' });
		}
	}
};

module.exports = { authenticateToken, authorizeProjectOwner };
