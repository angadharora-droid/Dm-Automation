import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, LogOut, RefreshCw } from 'lucide-react';
import { apiGet, loadSession, normalizeBaseUrl, saveSession } from './api.js';
import ActivitySection from './components/ActivitySection.jsx';
import AuthCard from './components/AuthCard.jsx';
import CountersSection from './components/CountersSection.jsx';
import ExamplesSection from './components/ExamplesSection.jsx';
import RulesSection from './components/RulesSection.jsx';
import StatusSection from './components/StatusSection.jsx';
import { relativeTime } from './utils.js';

const REFRESH_MS = 10_000;

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [phase, setPhase] = useState('idle'); // idle | connecting | connected
  const [authError, setAuthError] = useState('');
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [rules, setRules] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
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
    setLastUpdated(new Date().toISOString());
  }, []);

  const connect = useCallback(
    async ({ adminKey, backendUrl }) => {
      const next = { adminKey: adminKey.trim(), backendUrl: normalizeBaseUrl(backendUrl) };
      if (!next.adminKey) {
        setAuthError('Enter the admin key first.');
        return;
      }
      setPhase('connecting');
      setSession(next);
      sessionRef.current = next;
      try {
        await refresh();
        saveSession(next);
        setPhase('connected');
        setAuthError('');
      } catch (err) {
        saveSession({ adminKey: '', backendUrl: next.backendUrl });
        setPhase('idle');
        setAuthError(err.message);
      }
    },
    [refresh],
  );

  const disconnect = useCallback(() => {
    saveSession({ adminKey: '', backendUrl: sessionRef.current.backendUrl });
    setSession({ adminKey: '', backendUrl: sessionRef.current.backendUrl });
    setPhase('idle');
    setOverview(null);
    setAuthError('');
  }, []);

  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (err) {
      setPhase('idle');
      setAuthError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Poll while connected; drop back to login on failure (key revoked, backend down).
  useEffect(() => {
    if (phase !== 'connected') return undefined;
    const timer = setInterval(() => {
      refresh().catch((err) => {
        setPhase('idle');
        setAuthError(err.message);
      });
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [phase, refresh]);

  // Auto-connect when a key survived in sessionStorage.
  useEffect(() => {
    const stored = loadSession();
    if (stored.adminKey) connect(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const connected = phase === 'connected';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Bot size={19} strokeWidth={2} />
            </div>
            <h1>Instagram Automation</h1>
          </div>
          <div className="topbar-actions">
            {connected && lastUpdated && (
              <span className="hint" title={new Date(lastUpdated).toLocaleString()}>
                Updated {relativeTime(lastUpdated)}
              </span>
            )}
            {connected && (
              <button
                type="button"
                className="ghost icon-btn"
                onClick={manualRefresh}
                disabled={refreshing}
                aria-label="Refresh data now"
                title="Refresh now"
              >
                <RefreshCw size={16} className={refreshing ? 'spin' : undefined} />
              </button>
            )}
            <span className={`pill ${connected ? 'live' : ''}`}>
              <span className="dot" aria-hidden="true" />
              {connected ? 'Live' : 'Not connected'}
            </span>
            {connected && (
              <button
                type="button"
                className="ghost icon-btn"
                onClick={disconnect}
                aria-label="Disconnect and forget admin key"
                title="Disconnect"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="shell">
        {!connected && (
          <AuthCard
            initialSession={session}
            error={authError}
            connecting={phase === 'connecting'}
            onConnect={connect}
          />
        )}

        {connected && overview && (
          <main>
            <div className="grid-2">
              <StatusSection overview={overview} />
              <CountersSection counters={overview.counters} />
            </div>
            {rules && <ExamplesSection rules={rules} />}
            <ActivitySection entries={activity} persistent={overview.database === 'mongodb'} />
            {rules && <RulesSection rules={rules} />}
          </main>
        )}
      </div>

      <footer>
        <span className="hint">
          {connected ? 'Auto-refreshes every 10 seconds.' : 'Instagram automation admin panel.'}
        </span>
      </footer>
    </>
  );
}
