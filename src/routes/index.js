const express = require('express');
const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);

router.get('/', (req, res) => {
	res.json({ message: 'API is up and running!' });
});

module.exports = router;
