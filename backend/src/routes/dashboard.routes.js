import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboard.controller.js';

/** Mounted at /api/dashboard. Admin-key protected dashboard data API. */
export function createDashboardRouter(deps) {
  const router = Router();
  const controller = createDashboardController(deps);
  router.get('/overview', controller.overview);
  router.get('/activity', controller.activity);
  router.get('/posts', controller.posts);
  router.get('/analytics', controller.analytics);
  router.get('/rules', controller.rules);
  router.put('/rules', controller.updateRules);
  return router;
}
