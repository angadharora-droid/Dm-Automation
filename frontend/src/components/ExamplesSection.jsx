import { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  CornerDownRight,
  FlaskConical,
  MessageCircle,
  MessagesSquare,
  Send,
} from 'lucide-react';
import { findMatchingRule, renderPreview } from '../matcher.js';

function Bubble({ side, icon: Icon, tag, text }) {
  return (
    <div className={`bubble-row ${side}`}>
      <div className={`bubble ${side}`}>
        <div className="bubble-tag">
          <Icon size={12} aria-hidden="true" />
          {tag}
        </div>
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
      <div className="example-title">
        <MessageCircle size={13} aria-hidden="true" />
        Comment on a post · {rule.id}
      </div>
      <Bubble side="left" icon={MessageCircle} tag="Customer @somefan comments" text={trigger} />
      {sendsPublic && rule.publicReplyMessage && (
        <Bubble
          side="right"
          icon={CornerDownRight}
          tag="Automated public reply"
          text={renderPreview(rule.publicReplyMessage)}
        />
      )}
      {sendsDm && rule.dmMessage && (
        <Bubble
          side="right"
          icon={Send}
          tag="Automated private DM"
          text={renderPreview(rule.dmMessage)}
        />
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
      <div className="example-title">
        <Send size={13} aria-hidden="true" />
        Incoming DM · {rule.id}
      </div>
      <Bubble side="left" icon={Send} tag="Customer @somefan sends a DM" text={trigger} />
      <Bubble side="right" icon={Bot} tag="Automated reply" text={renderPreview(rule.reply)} />
      {rule.buttonTitle && rule.buttonUrl && (
        <div className="bubble-row right">
          <div className="bubble right bubble-card">
            <div className="bubble-card-head">{renderPreview(rule.buttonHeader || rule.buttonTitle)}</div>
            <div className="bubble-card-btn">{rule.buttonTitle}</div>
          </div>
        </div>
      )}
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
                ? { icon: CornerDownRight, tag: 'Public reply', text: rule.publicReplyMessage }
                : null,
              rule.dmMessage &&
              (rule.action === 'private_reply' || rule.action === 'private_and_public_reply')
                ? { icon: Send, tag: 'Private DM', text: rule.dmMessage }
                : null,
            ].filter(Boolean),
          }
        : { matched: null, replies: [] };
    } else {
      const rule = findMatchingRule(trimmed, rules.dmRules ?? []);
      const fallback = rules.dmFallbackReply;
      result = rule
        ? { matched: rule, replies: [{ icon: Bot, tag: 'Auto-reply', text: rule.reply }] }
        : fallback
          ? {
              matched: 'fallback',
              replies: [{ icon: Bot, tag: 'Fallback reply', text: fallback }],
            }
          : { matched: null, replies: [] };
    }
  }

  return (
    <div className="example">
      <div className="example-title">
        <FlaskConical size={13} aria-hidden="true" />
        Try it — type a message and see what the bot would do
      </div>
      <div className="sim-controls">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="sim-channel">Channel</label>
          <select
            id="sim-channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            <option value="comment">Comment on a post</option>
            <option value="dm">Incoming DM</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="sim-text">Message</label>
          <input
            id="sim-text"
            placeholder={
              channel === 'comment' ? 'e.g. What is the PRICE?' : 'e.g. Hi, how much is it?'
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>
      <div aria-live="polite">
        {result && (
          <div className="sim-result">
            <Bubble
              side="left"
              icon={channel === 'comment' ? MessageCircle : Send}
              tag={channel === 'comment' ? 'Customer comments' : 'Customer sends a DM'}
              text={trimmed}
            />
            {result.replies.map((reply) => (
              <Bubble
                key={reply.tag}
                side="right"
                icon={reply.icon}
                tag={reply.tag}
                text={renderPreview(reply.text)}
              />
            ))}
            {result.replies.length === 0 && (
              <p className="hint">No rule matches — the bot stays silent for this message.</p>
            )}
            {result.matched && result.matched !== 'fallback' && (
              <p className="hint matched-note">
                <CheckCircle2 size={13} aria-hidden="true" />
                Matched rule: <code>{result.matched.id}</code>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExamplesSection({ rules, subtitle = 'Generated from the live rules' }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <MessagesSquare size={17} aria-hidden="true" />
          How the automation replies
        </h2>
        <span className="hint">{subtitle}</span>
      </div>
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
