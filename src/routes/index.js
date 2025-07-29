const express = require('express');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const projectRoutes = require('./project.routes');
const { authenticateToken } = require('../middleware/auth.middleware');
const logRequest = require('../middleware/log.middleware');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/admin', authenticateToken, logRequest, adminRoutes);

router.get('/', (_req, res) => {
	res.json({ message: 'API is up and running!' });
});

module.exports = router;
