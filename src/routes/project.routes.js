const express = require('express');
const projectController = require('../controllers/project.controller');
const { authenticateToken, authorizeBackendRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.post('/', authorizeBackendRole, projectController.createProject);
router.get('/', projectController.getProjects);
router.get('/:projectId', projectController.getProjectById);
router.put('/:projectId', authorizeBackendRole, projectController.updateProject);
router.delete('/:projectId', authorizeBackendRole, projectController.deleteProject);

router.get('/:projectId/openapi', projectController.getProjectOpenApiSpec);
router.put('/:projectId/openapi', authorizeBackendRole, projectController.updateOpenApiSpec);

router.post('/:projectId/endpoints', authorizeBackendRole, projectController.addEndpoint);
router.put('/:projectId/endpoints', authorizeBackendRole, projectController.updateEndpoint);
router.delete('/:projectId/endpoints', authorizeBackendRole, projectController.deleteEndpointOperation);

router.post('/:projectId/endpoints/:methodPlusPath(*)/notes', authorizeBackendRole, projectController.addEndpointNote);
router.delete('/:projectId/endpoints/:methodPlusPath(*)/notes/:noteIndex', authorizeBackendRole, projectController.deleteEndpointNote);

module.exports = router;
