const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { login, getMe, updatePassword, getUsers, getTeams } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, getUsers);
router.post('/change-password', authenticateToken, updatePassword);
router.get('/teams', authenticateToken, getTeams);

module.exports = router;
