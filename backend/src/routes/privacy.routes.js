import { Router } from 'express';

/**
 * Public privacy policy page — required by Meta before an app can switch to
 * Live mode (App settings → Basic → Privacy Policy URL).
 */
const PRIVACY_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Privacy Policy — Micky's Instagram Automation</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 720px;
           margin: 0 auto; padding: 32px 20px 64px; line-height: 1.6; color: #1a1d27; }
    h1 { font-size: 26px; } h2 { font-size: 18px; margin-top: 28px; }
    p, li { font-size: 15.5px; } .muted { color: #667085; font-size: 13.5px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="muted">Micky's (Mickys By Cp Foods) — Instagram automation service. Last updated: 25 August 2026.</p>

  <h2>What this service does</h2>
  <p>This application powers automated replies for the official Micky's Instagram account
  (@mickys.ki.zimmedari). When you comment on our posts or send us a direct message, it may
  reply automatically on our behalf.</p>

  <h2>Data we process</h2>
  <ul>
    <li><strong>Comments on our posts</strong>: the comment text, your Instagram username and
    user ID, and the post commented on — used solely to decide whether and how to reply.</li>
    <li><strong>Direct messages to our account</strong>: the message text and your
    Instagram-scoped sender ID — used solely to send an automated reply.</li>
  </ul>

  <h2>What we store</h2>
  <ul>
    <li>Event identifiers (comment/message IDs) for up to 24 hours, to avoid duplicate replies.</li>
    <li>An operational activity log (event type, IDs, no message content for DMs) for up to 7 days.</li>
    <li>Aggregated daily counters (numbers only, no personal data) for up to 90 days.</li>
  </ul>
  <p>We do not sell or share this data with third parties. Data is processed via Meta's official
  Instagram API and stored on our own infrastructure.</p>

  <h2>Data deletion</h2>
  <p>To request deletion of any data related to your Instagram account, contact us via direct
  message to @mickys.ki.zimmedari on Instagram or email
  <a href="mailto:angadh.arora@gmail.com">angadh.arora@gmail.com</a> with your Instagram
  username. We will delete associated records within 30 days. Most stored data expires
  automatically within 7 days as described above.</p>

  <h2>Contact</h2>
  <p>Micky's (Mickys By Cp Foods) — <a href="mailto:angadh.arora@gmail.com">angadh.arora@gmail.com</a></p>
</body>
</html>`;

export function createPrivacyRouter() {
  const router = Router();
  router.get('/privacy', (_req, res) => {
    res.status(200).type('html').send(PRIVACY_HTML);
  });
  return router;
}
