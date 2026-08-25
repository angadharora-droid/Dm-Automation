import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';

export default function AuthCard({ initialSession, error, connecting, onConnect }) {
  const [adminKey, setAdminKey] = useState(initialSession.adminKey);
  const [backendUrl, setBackendUrl] = useState(initialSession.backendUrl);
  const [showBackendField, setShowBackendField] = useState(Boolean(initialSession.backendUrl));

  const submit = (event) => {
    event.preventDefault();
    onConnect({ adminKey, backendUrl });
  };

  return (
    <section className="card" style={{ maxWidth: 520, margin: '48px auto 0' }}>
      <div className="card-head">
        <h2>
          <KeyRound size={17} aria-hidden="true" />
          Admin access
        </h2>
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
        Enter the <code>ADMIN_API_KEY</code> configured on the server. It stays in this browser
        tab only and is sent as the <code>x-admin-key</code> header.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="admin-key">Admin API key</label>
          <input
            id="admin-key"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            autoComplete="off"
            autoFocus
            required
          />
        </div>

        {showBackendField ? (
          <div className="field">
            <label htmlFor="backend-url">Backend URL</label>
            <input
              id="backend-url"
              type="url"
              placeholder="https://your-app.up.railway.app"
              value={backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              autoComplete="off"
            />
            <p className="hint help">
              Leave empty when this page is served by the backend itself (the usual setup).
            </p>
          </div>
        ) : (
          <p className="hint" style={{ marginTop: 0 }}>
            Hosting this page separately from the backend?{' '}
            <button
              type="button"
              className="ghost"
              style={{ minHeight: 0, padding: '2px 8px', fontSize: 13 }}
              onClick={() => setShowBackendField(true)}
            >
              Set a backend URL
            </button>
          </p>
        )}

        <button type="submit" disabled={connecting} style={{ width: '100%', marginTop: 8 }}>
          {connecting ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" />
              Connecting…
            </>
          ) : (
            'Connect'
          )}
        </button>
      </form>
      {error && (
        <p className="error-text" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
