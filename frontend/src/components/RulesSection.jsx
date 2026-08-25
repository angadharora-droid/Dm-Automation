function Rule({ title, keywords, lines }) {
  return (
    <div className="rule">
      <strong>{title}</strong>
      <div className="kw">keywords: {keywords.join(', ')}</div>
      {lines.filter(Boolean).map((line) => (
        <div key={line} className="msg">
          {line}
        </div>
      ))}
    </div>
  );
}

export default function RulesSection({ rules }) {
  return (
    <section className="card">
      <h2>Automation rules</h2>
      {(rules.commentRules ?? []).map((rule) => (
        <Rule
          key={rule.id}
          title={`Comment rule: ${rule.id} (${rule.action})`}
          keywords={rule.keywords}
          lines={[
            rule.dmMessage ? `DM: ${rule.dmMessage}` : '',
            rule.publicReplyMessage ? `Public reply: ${rule.publicReplyMessage}` : '',
          ]}
        />
      ))}
      {(rules.dmRules ?? []).map((rule) => (
        <Rule key={rule.id} title={`DM rule: ${rule.id}`} keywords={rule.keywords} lines={[`Reply: ${rule.reply}`]} />
      ))}
      <p className="hint">
        {rules.dmFallbackReply
          ? `Unmatched DMs get: ${rules.dmFallbackReply}`
          : 'Unmatched DMs get no automated reply.'}
      </p>
    </section>
  );
}
