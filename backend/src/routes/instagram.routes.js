import { Router } from 'express';
import { createInstagramController } from '../controllers/instagram.controller.js';

/** Mounted at /api/instagram. Admin-key protected helper endpoints. */
export function createInstagramRouter(instagram) {
  const router = Router();
  const controller = createInstagramController(instagram);
  router.get('/account', controller.getAccount);
  router.post('/subscribe', controller.subscribeWebhooks);
  return router;
}
