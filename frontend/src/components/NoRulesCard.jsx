import { useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';

const TEMPLATE = `{
  "commentRules": [
    {
      "id": "my-first-campaign",
      "keywords": ["yourkeyword"],
      "action": "private_and_public_reply",
      "dmMessage": "Your DM text here",
      "publicReplyMessage": "Your public comment reply here",
      "mediaIds": []
    }
  ],
  "dmRules": [
    { "id": "my-dm-rule", "keywords": ["yourkeyword"], "reply": "Your DM auto-reply here" }
  ],
  "dmFallbackReply": null
}`;

export default function NoRulesCard() {
  const [copied, setCopied] = useState(false);

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can select the text manually */
    }
  };

  return (
    <section className="card">
      <div className="empty-state">
        <span className="empty-icon" aria-hidden="true">
          <Sparkles size={26} strokeWidth={1.8} />
        </span>
        <strong>No automations yet</strong>
        <p>
          You're in control — define your own rules with the <code>AUTOMATION_RULES</code>{' '}
          environment variable on the backend (Railway → your service → Variables). Paste JSON
          like this template, edit the keywords and replies, and redeploy:
        </p>
      </div>

      <div className="code-block-wrap">
        <button type="button" className="ghost code-copy" onClick={copyTemplate}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy template'}
        </button>
        <pre className="code-block">{TEMPLATE}</pre>
      </div>

      <ul className="hint bullet-list">
        <li>
          <code>action</code>: <code>private_reply</code>, <code>public_reply</code>, or{' '}
          <code>private_and_public_reply</code>
        </li>
        <li>
          <code>mediaIds</code>: leave <code>[]</code> for all posts, or list post IDs to scope a
          campaign to specific posts
        </li>
        <li>Keep reply texts free of the trigger keywords themselves (loop protection)</li>
        <li>Set <code>dmFallbackReply</code> to a string to answer DMs that match no rule</li>
      </ul>
    </section>
  );
}
