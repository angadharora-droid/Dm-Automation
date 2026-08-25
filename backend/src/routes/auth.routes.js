import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';

/** Mounted at /api/auth. */
export function createAuthRouter() {
  const router = Router();
  const controller = createAuthController();
  router.post('/login', controller.login);
  return router;
}
