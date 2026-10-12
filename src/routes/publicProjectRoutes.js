import express from 'express';
import { getPublishedProject, getPublishedProjects } from '../controllers/projectController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// This route intentionally exposes only projects explicitly published from the CRM.
router.get('/projects', asyncHandler(getPublishedProjects));
router.get('/projects/:slug', asyncHandler(getPublishedProject));

export default router;
