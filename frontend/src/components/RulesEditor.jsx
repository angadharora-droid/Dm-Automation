import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import ExamplesSection from './ExamplesSection.jsx';

/**
 * In-dashboard rule editor. Edits a local draft; Save PUTs the whole config
 * to the backend, where it is validated and stored (MongoDB) — no env vars
 * or redeploys needed.
 */

let keyCounter = 0;
const nextKey = () => `k${++keyCounter}`;

const splitList = (text) =>
  (text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function toDraft(saved) {
  return {
    commentRules: (saved.commentRules ?? []).map((rule) => ({
      key: nextKey(),
      id: rule.id,
      keywordsText: (rule.keywords ?? []).join(', '),
      action: rule.action,
      dmMessage: rule.dmMessage ?? '',
      publicReplyMessage: rule.publicReplyMessage ?? '',
      mediaIdsText: (rule.mediaIds ?? []).join(', '),
    })),
    dmRules: (saved.dmRules ?? []).map((rule) => ({
      key: nextKey(),
      id: rule.id,
      keywordsText: (rule.keywords ?? []).join(', '),
      reply: rule.reply ?? '',
      buttonTitle: rule.buttonTitle ?? '',
      buttonUrl: rule.buttonUrl ?? '',
      buttonHeader: rule.buttonHeader ?? '',
    })),
    dmFallbackReply: saved.dmFallbackReply ?? '',
  };
}

function toConfig(draft) {
  return {
    commentRules: draft.commentRules.map((rule) => ({
      id: rule.id.trim(),
      keywords: splitList(rule.keywordsText),
      action: rule.action,
      dmMessage: rule.dmMessage.trim() || undefined,
      publicReplyMessage: rule.publicReplyMessage.trim() || undefined,
      mediaIds: splitList(rule.mediaIdsText),
    })),
    dmRules: draft.dmRules.map((rule) => ({
      id: rule.id.trim(),
      keywords: splitList(rule.keywordsText),
      reply: rule.reply.trim(),
      buttonTitle: rule.buttonTitle.trim() || undefined,
      buttonUrl: rule.buttonUrl.trim() || undefined,
      buttonHeader: rule.buttonHeader.trim() || undefined,
    })),
    dmFallbackReply: draft.dmFallbackReply.trim() || null,
  };
}

export default function RulesEditor({ saved, onSave }) {
  const [draft, setDraft] = useState(() => toDraft(saved));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);

  // Pick up server-side changes (e.g. another device) only while not editing.
  const savedJson = JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) setDraft(toDraft(JSON.parse(savedJson)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedJson is the comparison key
  }, [savedJson]);

  const edit = (updater) => {
    setDraft((current) => updater(structuredClone(current)));
    setDirty(true);
    setSavedFlash(false);
  };

  const editCommentRule = (key, field, value) =>
    edit((d) => {
      const rule = d.commentRules.find((r) => r.key === key);
      if (rule) rule[field] = value;
      return d;
    });

  const editDmRule = (key, field, value) =>
    edit((d) => {
      const rule = d.dmRules.find((r) => r.key === key);
      if (rule) rule[field] = value;
      return d;
    });

  const addCommentRule = () =>
    edit((d) => {
      d.commentRules.push({
        key: nextKey(),
        id: `comment-rule-${d.commentRules.length + 1}`,
        keywordsText: '',
        action: 'private_reply',
        dmMessage: '',
        publicReplyMessage: '',
        mediaIdsText: '',
      });
      return d;
    });

  const addDmRule = () =>
    edit((d) => {
      d.dmRules.push({
        key: nextKey(),
        id: `dm-rule-${d.dmRules.length + 1}`,
        keywordsText: '',
        reply: '',
        buttonTitle: '',
        buttonUrl: '',
        buttonHeader: '',
      });
      return d;
    });

  const removeRule = (listName, key) =>
    edit((d) => {
      d[listName] = d[listName].filter((rule) => rule.key !== key);
      return d;
    });

  const discard = () => {
    setDraft(toDraft(saved));
    setDirty(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(toConfig(draft));
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError({ message: err.message, details: err.details ?? [] });
    } finally {
      setSaving(false);
    }
  };

  const isEmpty = draft.commentRules.length === 0 && draft.dmRules.length === 0;
  const wantsDm = (action) => action === 'private_reply' || action === 'private_and_public_reply';
  const wantsPublic = (action) => action === 'public_reply' || action === 'private_and_public_reply';

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>
            <SlidersHorizontal size={17} aria-hidden="true" />
            Your automations
          </h2>
          <span className="hint">Saved instantly to the backend — no redeploy needed</span>
        </div>

        {isEmpty && (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              <Sparkles size={26} strokeWidth={1.8} />
            </span>
            <strong>No automations yet</strong>
            <p>Create your first rule below — pick keywords and write the replies.</p>
          </div>
        )}

        <div className="editor-section">
          <h3 className="editor-section-title">
            <MessageCircle size={14} aria-hidden="true" />
            Comment rules
            <span className="hint">when someone comments on your posts</span>
          </h3>

          {draft.commentRules.map((rule, index) => (
            <div key={rule.key} className="rule editor-rule">
              <div className="editor-row">
                <div className="field">
                  <label htmlFor={`cr-name-${rule.key}`}>Rule name</label>
                  <input
                    id={`cr-name-${rule.key}`}
                    value={rule.id}
                    onChange={(e) => editCommentRule(rule.key, 'id', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`cr-action-${rule.key}`}>What should happen</label>
                  <select
                    id={`cr-action-${rule.key}`}
                    value={rule.action}
                    onChange={(e) => editCommentRule(rule.key, 'action', e.target.value)}
                  >
                    <option value="private_reply">Send a private DM</option>
                    <option value="public_reply">Reply publicly to the comment</option>
                    <option value="private_and_public_reply">DM + public reply</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="ghost icon-btn danger"
                  onClick={() => removeRule('commentRules', rule.key)}
                  aria-label={`Delete comment rule ${index + 1}`}
                  title="Delete rule"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="field">
                <label htmlFor={`cr-kw-${rule.key}`}>Trigger keywords (comma-separated)</label>
                <input
                  id={`cr-kw-${rule.key}`}
                  placeholder="price, buy, link"
                  value={rule.keywordsText}
                  onChange={(e) => editCommentRule(rule.key, 'keywordsText', e.target.value)}
                />
              </div>

              {wantsDm(rule.action) && (
                <div className="field">
                  <label htmlFor={`cr-dm-${rule.key}`}>Private DM message</label>
                  <textarea
                    id={`cr-dm-${rule.key}`}
                    rows={2}
                    placeholder="Hey @{username}! Thanks for your interest — here are the details."
                    value={rule.dmMessage}
                    onChange={(e) => editCommentRule(rule.key, 'dmMessage', e.target.value)}
                  />
                  <p className="hint help">
                    <code>{'{username}'}</code> inserts the commenter's handle. Note: Meta allows
                    text only in comment-DMs — tappable buttons are available on DM rules.
                  </p>
                </div>
              )}

              {wantsPublic(rule.action) && (
                <div className="field">
                  <label htmlFor={`cr-pub-${rule.key}`}>Public comment reply</label>
                  <textarea
                    id={`cr-pub-${rule.key}`}
                    rows={2}
                    placeholder="@{username} check your DMs! 📩"
                    value={rule.publicReplyMessage}
                    onChange={(e) => editCommentRule(rule.key, 'publicReplyMessage', e.target.value)}
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor={`cr-media-${rule.key}`}>
                  Limit to specific posts <span className="hint">(optional post IDs, comma-separated — empty = all posts)</span>
                </label>
                <input
                  id={`cr-media-${rule.key}`}
                  value={rule.mediaIdsText}
                  onChange={(e) => editCommentRule(rule.key, 'mediaIdsText', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button type="button" className="ghost add-btn" onClick={addCommentRule}>
            <Plus size={15} aria-hidden="true" />
            Add comment rule
          </button>
        </div>

        <div className="editor-section">
          <h3 className="editor-section-title">
            <Send size={14} aria-hidden="true" />
            DM rules
            <span className="hint">when someone sends you a direct message</span>
          </h3>

          {draft.dmRules.map((rule, index) => (
            <div key={rule.key} className="rule editor-rule">
              <div className="editor-row">
                <div className="field">
                  <label htmlFor={`dm-name-${rule.key}`}>Rule name</label>
                  <input
                    id={`dm-name-${rule.key}`}
                    value={rule.id}
                    onChange={(e) => editDmRule(rule.key, 'id', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`dm-kw-${rule.key}`}>Trigger keywords (comma-separated)</label>
                  <input
                    id={`dm-kw-${rule.key}`}
                    placeholder="price, how much"
                    value={rule.keywordsText}
                    onChange={(e) => editDmRule(rule.key, 'keywordsText', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="ghost icon-btn danger"
                  onClick={() => removeRule('dmRules', rule.key)}
                  aria-label={`Delete DM rule ${index + 1}`}
                  title="Delete rule"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="field">
                <label htmlFor={`dm-reply-${rule.key}`}>Automated reply</label>
                <textarea
                  id={`dm-reply-${rule.key}`}
                  rows={2}
                  placeholder="Hi @{username}! Thanks for reaching out."
                  value={rule.reply}
                  onChange={(e) => editDmRule(rule.key, 'reply', e.target.value)}
                />
                <p className="hint help">
                  <code>{'{username}'}</code> inserts the sender's handle automatically.
                </p>
              </div>

              <div className="editor-row button-row">
                <div className="field">
                  <label htmlFor={`dm-btn-title-${rule.key}`}>
                    Button text <span className="hint">(optional, max 20 chars)</span>
                  </label>
                  <input
                    id={`dm-btn-title-${rule.key}`}
                    maxLength={20}
                    placeholder="View Menu & Links"
                    value={rule.buttonTitle}
                    onChange={(e) => editDmRule(rule.key, 'buttonTitle', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`dm-btn-url-${rule.key}`}>Button link</label>
                  <input
                    id={`dm-btn-url-${rule.key}`}
                    type="url"
                    placeholder="https://linktr.ee/…"
                    value={rule.buttonUrl}
                    onChange={(e) => editDmRule(rule.key, 'buttonUrl', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`dm-btn-head-${rule.key}`}>
                    Button card heading <span className="hint">(optional)</span>
                  </label>
                  <input
                    id={`dm-btn-head-${rule.key}`}
                    maxLength={80}
                    placeholder="Micky's ❤️"
                    value={rule.buttonHeader}
                    onChange={(e) => editDmRule(rule.key, 'buttonHeader', e.target.value)}
                  />
                </div>
              </div>
              <p className="hint" style={{ marginTop: -4 }}>
                Adds a real tappable button under the reply (sent as a second message). Fill both
                button text and link to enable it.
              </p>
            </div>
          ))}

          <button type="button" className="ghost add-btn" onClick={addDmRule}>
            <Plus size={15} aria-hidden="true" />
            Add DM rule
          </button>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="dm-fallback">
            Fallback reply for unmatched DMs <span className="hint">(leave empty to stay silent)</span>
          </label>
          <input
            id="dm-fallback"
            value={draft.dmFallbackReply}
            onChange={(e) => edit((d) => ({ ...d, dmFallbackReply: e.target.value }))}
          />
        </div>

        <p className="hint">
          Tip: keep reply texts free of the trigger keywords themselves — it's one of the
          protections against the bot replying to its own messages.
        </p>

        {error && (
          <div className="banner error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              {error.message}
              {error.details.length > 0 && (
                <ul className="bullet-list" style={{ marginTop: 6 }}>
                  {error.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </span>
          </div>
        )}

        {(dirty || saving || savedFlash) && (
          <div className="save-bar">
            {savedFlash && !dirty ? (
              <span className="hint saved-note">
                <Check size={15} aria-hidden="true" /> Saved — rules are live now
              </span>
            ) : (
              <>
                <span className="hint">You have unsaved changes</span>
                <button type="button" className="ghost" onClick={discard} disabled={saving}>
                  Discard
                </button>
                <button type="button" onClick={save} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={15} className="spin" aria-hidden="true" /> Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {!isEmpty && <ExamplesSection rules={toConfig(draft)} subtitle="Live preview of the rules above" />}
    </>
  );
}
