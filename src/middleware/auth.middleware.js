const jwt = require('jsonwebtoken');
const config = require('../config');
const { readUsersDB } = require('../utils/general');

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

const authorizeBackendRole = (req, res, next) => {
	if (req.user && req.user.role === 'backend') {
		next();
	} else {
		res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
	}
};

module.exports = { authenticateToken, authorizeBackendRole };
