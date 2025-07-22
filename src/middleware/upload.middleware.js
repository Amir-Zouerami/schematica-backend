const multer = require('multer');
const path = require('path');
const fs = require('fs');

const profilePicturesPath = path.join(__dirname, '..', '..', 'public', 'profile-pictures');

if (!fs.existsSync(profilePicturesPath)) {
	fs.mkdirSync(profilePicturesPath, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, profilePicturesPath);
	},
	filename: (req, file, cb) => {
		const username = req.body.username;
		const extension = path.extname(file.originalname);
		const finalFilename = `${username}${extension}`.toLowerCase();
		req.profileImagePath = `/profile-pictures/${finalFilename}`;
		cb(null, finalFilename);
	},
});

const fileFilter = (req, file, cb) => {
	if (file.mimetype.startsWith('image/')) {
		cb(null, true);
	}
	else {
		cb(new Error('Only image files are allowed!'), false);
	}
};

const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
	limits: {
		fileSize: 1024 * 1024 * 2, // 2MB limit
	},
});

module.exports = upload;
