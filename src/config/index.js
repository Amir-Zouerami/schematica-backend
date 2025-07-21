require('dotenv').config();
const fs = require('fs');
const path = require('path');

const config = {
	httpPort: process.env.HTTP_PORT || 3001,
	httpsPort: process.env.HTTPS_PORT || 9999,
	jwtSecret: process.env.JWT_SECRET,

	certs: {
		key: fs.readFileSync('./certs/key.pem'),
		cert: fs.readFileSync('./certs/cert.pem'),
	},

	dataPath: path.join(__dirname, '..', '..', 'app_data'),
	projectsPath: path.join(__dirname, '..', '..', 'app_data', 'projects'),

	inlineComponentsOnSave: process.env.OPENAPI_INLINE_COMPONENTS_ON_SAVE === 'true',

	// 'AUTHENTICATED': Any logged-in user can create a project.
	// 'ADMIN_ONLY': Only users with the 'admin' role can create projects.
	projectCreationPolicy: process.env.PROJECT_CREATION_POLICY || 'AUTHENTICATED',
};

if (!config.jwtSecret) {
	console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in your .env file.');
	process.exit(1);
}

try {
	if (!fs.existsSync(config.dataPath)) {
		fs.mkdirSync(config.dataPath);
		console.log(`Created data directory: ${config.dataPath}`);
	}
	if (!fs.existsSync(config.projectsPath)) {
		fs.mkdirSync(config.projectsPath);
		console.log(`Created projects directory: ${config.projectsPath}`);
	}
}
catch (err) {
	console.error('FATAL ERROR: Could not create data directories.', err);
	process.exit(1);
}

module.exports = config;
