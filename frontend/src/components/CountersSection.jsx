function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function CountersSection({ counters = {} }) {
  const errors = counters.errors ?? 0;
  return (
    <section className="card">
      <h2>Counters</h2>
      <div className="grid">
        <Stat label="Webhooks" value={counters.webhooksReceived ?? 0} />
        <Stat label="Comments" value={counters.commentsReceived ?? 0} />
        <Stat label="DMs received" value={counters.messagesReceived ?? 0} />
        <Stat label="DMs sent" value={counters.dmsSent ?? 0} tone="ok" />
        <Stat label="Public replies" value={counters.publicRepliesSent ?? 0} tone="ok" />
        <Stat label="Duplicates skipped" value={counters.duplicatesSkipped ?? 0} />
        <Stat label="Errors" value={errors} tone={errors > 0 ? 'err' : ''} />
      </div>
    </section>
  );
}
