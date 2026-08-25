import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboard.controller.js';

/** Mounted at /api/dashboard. Admin-key protected dashboard data API. */
export function createDashboardRouter(deps) {
  const router = Router();
  const controller = createDashboardController(deps);
  router.get('/overview', controller.overview);
  router.get('/activity', controller.activity);
  router.get('/rules', controller.rules);
  return router;
}
