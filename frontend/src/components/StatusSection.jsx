function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function StatusSection({ overview }) {
  const configured = overview.configured ?? {};
  return (
    <section className="card">
      <h2>Status</h2>
      <div className="grid">
        {Object.entries(configured).map(([name, isSet]) => (
          <Stat key={name} label={name} value={isSet ? 'set' : 'missing'} tone={isSet ? 'ok' : 'err'} />
        ))}
      </div>
      <p className="hint">
        Environment: {overview.nodeEnv} · Meta API {overview.metaApiVersion} · Storage:{' '}
        {overview.database} · Up since {new Date(overview.startedAt).toLocaleString()}
      </p>
    </section>
  );
}
