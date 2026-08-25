import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import BrandGlyph from './BrandGlyph.jsx';

export default function AuthCard({ initialSession, error, connecting, onConnect }) {
  const [adminKey, setAdminKey] = useState(initialSession.adminKey);
  const [backendUrl, setBackendUrl] = useState(initialSession.backendUrl);
  const [showBackendField, setShowBackendField] = useState(Boolean(initialSession.backendUrl));

  const submit = (event) => {
    event.preventDefault();
    onConnect({ adminKey, backendUrl });
  };

  return (
    <section className="card auth-card">
      <div className="auth-brand">
        <div className="brand-mark" aria-hidden="true">
          <BrandGlyph size={26} />
        </div>
        <h1>Instagram Automation</h1>
        <p className="hint">
          Sign in with the <code>ADMIN_API_KEY</code> set on your server. It stays in this browser
          tab only.
        </p>
      </div>

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
            Hosting this page separately?{' '}
            <button type="button" className="link-btn" onClick={() => setShowBackendField(true)}>
              Set a backend URL
            </button>
          </p>
        )}

        <button type="submit" disabled={connecting} style={{ width: '100%', marginTop: 10 }}>
          {connecting ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" />
              Connecting…
            </>
          ) : (
            'Sign in'
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
