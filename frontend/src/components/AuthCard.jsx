import { useState } from 'react';

export default function AuthCard({ initialSession, error, onConnect }) {
  const [adminKey, setAdminKey] = useState(initialSession.adminKey);
  const [backendUrl, setBackendUrl] = useState(initialSession.backendUrl);

  const submit = (event) => {
    event.preventDefault();
    onConnect({ adminKey, backendUrl });
  };

  return (
    <section className="card">
      <h2>Admin access</h2>
      <p className="hint">
        Enter the <code>ADMIN_API_KEY</code> configured on the server. The key stays in this
        browser tab only (sessionStorage) and is sent as the <code>x-admin-key</code> header.
      </p>
      <form onSubmit={submit}>
        <div className="row">
          <input
            type="url"
            placeholder="Backend URL — leave empty when this page is served by the backend"
            value={backendUrl}
            onChange={(event) => setBackendUrl(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="row">
          <input
            type="password"
            placeholder="Admin API key"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            autoComplete="off"
          />
          <button type="submit">Connect</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
