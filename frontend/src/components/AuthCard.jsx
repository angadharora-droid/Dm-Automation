import { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import BrandGlyph from './BrandGlyph.jsx';

export default function AuthCard({ initialSession, error, connecting, onConnect }) {
  const [mode, setMode] = useState(initialSession.mode ?? 'password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminKey, setAdminKey] = useState(initialSession.adminKey);
  const [backendUrl, setBackendUrl] = useState(initialSession.backendUrl);
  const [showBackendField, setShowBackendField] = useState(Boolean(initialSession.backendUrl));

  const submit = (event) => {
    event.preventDefault();
    onConnect({ mode, username, password, adminKey, backendUrl });
  };

  return (
    <section className="card auth-card">
      <div className="auth-brand">
        <div className="brand-mark" aria-hidden="true">
          <BrandGlyph size={26} />
        </div>
        <h1>Instagram Automation</h1>
        <p className="hint">
          {mode === 'password'
            ? 'Sign in with your admin login ID and password.'
            : 'Sign in with the ADMIN_API_KEY set on your server.'}
        </p>
      </div>

      <form onSubmit={submit}>
        {mode === 'password' ? (
          <>
            <div className="field">
              <label htmlFor="login-id">Login ID</label>
              <input
                id="login-id"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <div className="password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="ghost icon-btn password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        ) : (
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
        )}

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
        ) : null}

        <button type="submit" disabled={connecting} style={{ width: '100%', marginTop: 10 }}>
          {connecting ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" />
              Signing in…
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

      <div className="auth-alt">
        <button
          type="button"
          className="link-btn"
          onClick={() => setMode(mode === 'password' ? 'key' : 'password')}
        >
          {mode === 'password' ? 'Use an admin API key instead' : 'Use login ID & password instead'}
        </button>
        {!showBackendField && (
          <button type="button" className="link-btn" onClick={() => setShowBackendField(true)}>
            Hosting separately?
          </button>
        )}
      </div>
    </section>
  );
}
