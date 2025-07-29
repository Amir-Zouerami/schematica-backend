const express = require('express');
const logRequest = require('../middleware/log.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const { login, getMe, updatePassword, getUsers, getTeams } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateToken, logRequest, getMe);
router.get('/users', authenticateToken, logRequest, getUsers);
router.post('/change-password', authenticateToken, logRequest, updatePassword);
router.get('/teams', authenticateToken, logRequest, getTeams);

module.exports = router;
