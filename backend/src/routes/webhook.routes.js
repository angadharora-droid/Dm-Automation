import { Router } from 'express';
import { createReceiveWebhookHandler, verifyWebhook } from '../controllers/webhook.controller.js';

/** Mounted at /webhooks — the Meta callback URL is <domain>/webhooks/instagram */
export function createWebhookRouter(deps) {
  const router = Router();
  router.get('/instagram', verifyWebhook);
  router.post('/instagram', createReceiveWebhookHandler(deps));
  return router;
}
