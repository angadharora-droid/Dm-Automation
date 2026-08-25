import { useState } from 'react';
import { findMatchingRule } from '../matcher.js';

function Bubble({ side, tag, text }) {
  return (
    <div className={`bubble-row ${side}`}>
      <div className={`bubble ${side}`}>
        <div className="bubble-tag">{tag}</div>
        {text}
      </div>
    </div>
  );
}

/** Example conversation for one comment rule, using its first keyword. */
function CommentExample({ rule }) {
  const trigger = (rule.keywords[0] ?? 'PRICE').toUpperCase();
  const sendsDm = rule.action === 'private_reply' || rule.action === 'private_and_public_reply';
  const sendsPublic = rule.action === 'public_reply' || rule.action === 'private_and_public_reply';
  return (
    <div className="example">
      <div className="example-title">Comment on a post → automated reply ({rule.id})</div>
      <Bubble side="left" tag="💬 Customer comments" text={trigger} />
      {sendsPublic && rule.publicReplyMessage && (
        <Bubble side="right" tag="↩️ Automated public reply" text={rule.publicReplyMessage} />
      )}
      {sendsDm && rule.dmMessage && (
        <Bubble side="right" tag="✉️ Automated private DM" text={rule.dmMessage} />
      )}
    </div>
  );
}

/** Example conversation for one DM rule, using its first keyword. */
function DmExample({ rule }) {
  const keyword = rule.keywords[0] ?? 'price';
  const trigger = keyword.includes(' ') ? `Hi, ${keyword}?` : `Hi, what is the ${keyword}?`;
  return (
    <div className="example">
      <div className="example-title">Incoming DM → automated reply ({rule.id})</div>
      <Bubble side="left" tag="✉️ Customer sends a DM" text={trigger} />
      <Bubble side="right" tag="🤖 Automated reply" text={rule.reply} />
    </div>
  );
}

/** Type any message and see exactly what the automation would do. */
function Simulator({ rules }) {
  const [channel, setChannel] = useState('comment');
  const [text, setText] = useState('');

  const trimmed = text.trim();
  let result = null;
  if (trimmed) {
    if (channel === 'comment') {
      const rule = findMatchingRule(trimmed, rules.commentRules ?? []);
      result = rule
        ? {
            matched: rule,
            replies: [
              rule.publicReplyMessage &&
              (rule.action === 'public_reply' || rule.action === 'private_and_public_reply')
                ? { tag: '↩️ Public reply', text: rule.publicReplyMessage }
                : null,
              rule.dmMessage &&
              (rule.action === 'private_reply' || rule.action === 'private_and_public_reply')
                ? { tag: '✉️ Private DM', text: rule.dmMessage }
                : null,
            ].filter(Boolean),
          }
        : { matched: null, replies: [] };
    } else {
      const rule = findMatchingRule(trimmed, rules.dmRules ?? []);
      const fallback = rules.dmFallbackReply;
      result = rule
        ? { matched: rule, replies: [{ tag: '🤖 Auto-reply', text: rule.reply }] }
        : fallback
          ? { matched: 'fallback', replies: [{ tag: '🤖 Fallback reply', text: fallback }] }
          : { matched: null, replies: [] };
    }
  }

  return (
    <div className="example simulator">
      <div className="example-title">Try it — type a message and see what the bot would do</div>
      <div className="row">
        <select value={channel} onChange={(event) => setChannel(event.target.value)}>
          <option value="comment">Comment on a post</option>
          <option value="dm">Incoming DM</option>
        </select>
        <input
          placeholder={channel === 'comment' ? 'e.g. What is the PRICE?' : 'e.g. Hi, how much is it?'}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {result && (
        <div className="sim-result">
          <Bubble
            side="left"
            tag={channel === 'comment' ? '💬 Customer comments' : '✉️ Customer sends a DM'}
            text={trimmed}
          />
          {result.replies.map((reply) => (
            <Bubble key={reply.tag} side="right" tag={reply.tag} text={reply.text} />
          ))}
          {result.replies.length === 0 && (
            <p className="hint">No rule matches — the bot stays silent for this message.</p>
          )}
          {result.matched && result.matched !== 'fallback' && (
            <p className="hint">
              Matched rule: <code>{result.matched.id}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExamplesSection({ rules }) {
  return (
    <section className="card">
      <h2>How the automation replies</h2>
      <p className="hint">
        Example conversations generated from the live rules — this is exactly what a customer
        experiences.
      </p>
      {(rules.commentRules ?? []).map((rule) => (
        <CommentExample key={rule.id} rule={rule} />
      ))}
      {(rules.dmRules ?? []).map((rule) => (
        <DmExample key={rule.id} rule={rule} />
      ))}
      <Simulator rules={rules} />
    </section>
  );
}
