import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, loadSession, normalizeBaseUrl, saveSession } from './api.js';
import ActivitySection from './components/ActivitySection.jsx';
import AuthCard from './components/AuthCard.jsx';
import CountersSection from './components/CountersSection.jsx';
import ExamplesSection from './components/ExamplesSection.jsx';
import RulesSection from './components/RulesSection.jsx';
import StatusSection from './components/StatusSection.jsx';

const REFRESH_MS = 10_000;

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [connected, setConnected] = useState(false);
  const [authError, setAuthError] = useState('');
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [rules, setRules] = useState(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const refresh = useCallback(async () => {
    const { backendUrl, adminKey } = sessionRef.current;
    const [overviewData, activityData, rulesData] = await Promise.all([
      apiGet(backendUrl, adminKey, '/api/dashboard/overview'),
      apiGet(backendUrl, adminKey, '/api/dashboard/activity?limit=50'),
      apiGet(backendUrl, adminKey, '/api/dashboard/rules'),
    ]);
    setOverview(overviewData);
    setActivity(activityData.entries ?? []);
    setRules(rulesData);
  }, []);

  const connect = useCallback(
    async ({ adminKey, backendUrl }) => {
      const next = { adminKey: adminKey.trim(), backendUrl: normalizeBaseUrl(backendUrl) };
      if (!next.adminKey) {
        setAuthError('Enter the admin key first.');
        return;
      }
      setSession(next);
      sessionRef.current = next;
      try {
        await refresh();
        saveSession(next);
        setConnected(true);
        setAuthError('');
      } catch (err) {
        saveSession({ adminKey: '', backendUrl: next.backendUrl });
        setConnected(false);
        setAuthError(err.message);
      }
    },
    [refresh],
  );

  // Poll while connected; disconnect on failure (e.g. key revoked, backend down).
  useEffect(() => {
    if (!connected) return undefined;
    const timer = setInterval(() => {
      refresh().catch((err) => {
        setConnected(false);
        setAuthError(err.message);
      });
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [connected, refresh]);

  // Auto-connect when a key survived in sessionStorage.
  useEffect(() => {
    const stored = loadSession();
    if (stored.adminKey) connect(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <>
      <header>
        <h1>Instagram Automation</h1>
        <div className={`pill ${connected ? 'pill-ok' : 'pill-muted'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </div>
      </header>

      {!connected && (
        <AuthCard initialSession={session} error={authError} onConnect={connect} />
      )}

      {connected && overview && (
        <main>
          <StatusSection overview={overview} />
          <CountersSection counters={overview.counters} />
          {rules && <ExamplesSection rules={rules} />}
          <ActivitySection entries={activity} persistent={overview.database === 'mongodb'} />
          {rules && <RulesSection rules={rules} />}
        </main>
      )}

      <footer>
        <span className="hint">Auto-refreshes every 10 seconds while connected.</span>
      </footer>
    </>
  );
}
