import { CornerDownRight, Send, SlidersHorizontal } from 'lucide-react';

function Rule({ title, action, keywords, lines }) {
  return (
    <div className="rule">
      <div className="rule-head">
        <strong>{title}</strong>
        {action && <span className="action-badge">{action.replaceAll('_', ' ')}</span>}
      </div>
      <div className="kw-chips">
        {keywords.map((keyword) => (
          <span key={keyword} className="kw-chip">
            {keyword}
          </span>
        ))}
      </div>
      {lines
        .filter((line) => line?.text)
        .map((line) => {
          const Icon = line.icon;
          return (
            <div key={line.text} className="msg">
              <Icon size={13} aria-hidden="true" />
              <span>{line.text}</span>
            </div>
          );
        })}
    </div>
  );
}

export default function RulesSection({ rules }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <SlidersHorizontal size={17} aria-hidden="true" />
          Automation rules
        </h2>
        <span className="hint">Configured via AUTOMATION_RULES</span>
      </div>
      {(rules.commentRules ?? []).map((rule) => (
        <Rule
          key={rule.id}
          title={rule.id}
          action={rule.action}
          keywords={rule.keywords}
          lines={[
            rule.publicReplyMessage
              ? { icon: CornerDownRight, text: `Public reply: ${rule.publicReplyMessage}` }
              : null,
            rule.dmMessage ? { icon: Send, text: `DM: ${rule.dmMessage}` } : null,
          ]}
        />
      ))}
      {(rules.dmRules ?? []).map((rule) => (
        <Rule
          key={rule.id}
          title={rule.id}
          action="dm reply"
          keywords={rule.keywords}
          lines={[{ icon: Send, text: `Reply: ${rule.reply}` }]}
        />
      ))}
      <p className="hint">
        {rules.dmFallbackReply
          ? `Unmatched DMs get: ${rules.dmFallbackReply}`
          : 'Unmatched DMs get no automated reply.'}
      </p>
    </section>
  );
}
