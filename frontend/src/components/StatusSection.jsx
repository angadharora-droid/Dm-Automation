import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

const CONFIG_LABELS = {
  metaAppSecret: 'Meta app secret',
  metaVerifyToken: 'Webhook verify token',
  instagramAccessToken: 'Instagram access token',
  instagramAccountId: 'Instagram account ID',
  mongodb: 'MongoDB connection',
};

export default function StatusSection({ overview }) {
  const configured = overview.configured ?? {};
  const missing = overview.missingConfig ?? [];

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <ShieldCheck size={17} aria-hidden="true" />
          Status
        </h2>
      </div>

      {missing.length > 0 && (
        <div className="banner" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            Missing configuration: {missing.join(', ')} — set these in your hosting environment
            variables.
          </span>
        </div>
      )}

      <div className="config-list">
        {Object.entries(configured).map(([name, isSet]) => (
          <div key={name} className={`config-row ${isSet ? 'set' : 'missing'}`}>
            {isSet ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <XCircle size={16} aria-hidden="true" />
            )}
            <span>{CONFIG_LABELS[name] ?? name}</span>
            <span className="state">{isSet ? 'set' : 'missing'}</span>
          </div>
        ))}
      </div>

      <div className="meta-chips">
        <span className="chip">env: {overview.nodeEnv}</span>
        <span className="chip">Meta API {overview.metaApiVersion}</span>
        <span className="chip">storage: {overview.database}</span>
        <span className="chip" title={new Date(overview.startedAt).toLocaleString()}>
          up since {new Date(overview.startedAt).toLocaleTimeString()}
        </span>
      </div>
    </section>
  );
}
