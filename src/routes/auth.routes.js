const express = require('express');
const { login, getMe, updatePassword, getUsers } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, getUsers);
router.post('/change-password', authenticateToken, updatePassword);

module.exports = router;
