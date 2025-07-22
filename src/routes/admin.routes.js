const express = require('express');
const upload = require('../middleware/upload.middleware');

const {
	createTeam,
	updateTeam,
	deleteTeam,
	getAllUsers,
	createUser,
	updateUser,
	deleteUser,
} = require('../controllers/admin.controller');

const router = express.Router();

router.use((req, res, next) => {
	if (req.user && req.user.role === 'admin') {
		next();
	}
	else {
		res.status(403).json({ message: 'Forbidden: Administrator access required.' });
	}
});

// --- Team Management Routes ---
router.post('/teams', createTeam);
router.put('/teams/:teamId', updateTeam);
router.delete('/teams/:teamId', deleteTeam);

// --- User Management Routes ---
router.get('/users', getAllUsers);
router.post('/users', upload.single('profileImage'), createUser);
router.put('/users/:userId', upload.single('profileImage'), updateUser);
router.delete('/users/:userId', deleteUser);

module.exports = router;
