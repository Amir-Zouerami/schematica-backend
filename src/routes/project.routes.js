const express = require('express');
const logRequest = require('../middleware/log.middleware');
const projectController = require('../controllers/project.controller');
const { authenticateToken, authorizeProjectOwner } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);
router.use(logRequest);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:projectId', projectController.getProjectById);
router.put('/:projectId', authorizeProjectOwner, projectController.updateProject);
router.delete('/:projectId', authorizeProjectOwner, projectController.deleteProject);

router.get('/:projectId/openapi', projectController.getProjectOpenApiSpec);
router.put('/:projectId/openapi', authorizeProjectOwner, projectController.updateOpenApiSpec);

router.post('/:projectId/endpoints', authorizeProjectOwner, projectController.addEndpoint);
router.put('/:projectId/endpoints', authorizeProjectOwner, projectController.updateEndpoint);
router.delete('/:projectId/endpoints', authorizeProjectOwner, projectController.deleteEndpointOperation);

router.post('/:projectId/endpoints/:methodPlusPath(*)/notes', projectController.addEndpointNote);
router.delete('/:projectId/endpoints/:methodPlusPath(*)/notes/:noteIndex', projectController.deleteEndpointNote);

module.exports = router;
