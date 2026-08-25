import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiGet, loadSession, normalizeBaseUrl, saveSession } from './api.js';
import ActivitySection from './components/ActivitySection.jsx';
import AuthCard from './components/AuthCard.jsx';
import ExamplesSection from './components/ExamplesSection.jsx';
import HomeView from './components/HomeView.jsx';
import RulesSection from './components/RulesSection.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatusSection from './components/StatusSection.jsx';
import { getGreeting, relativeTime } from './utils.js';

const REFRESH_MS = 10_000;

const PAGE_TITLES = {
  activity: { title: 'Activity', sub: 'Every webhook event and automated action, as it happens.' },
  automations: { title: 'Automations', sub: 'What your customers experience, and the rules behind it.' },
  setup: { title: 'Setup', sub: 'Connection status and server configuration.' },
};

function homePageMeta() {
  return { title: `${getGreeting()} 👋`, sub: "Here's what your automation has been doing." };
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [phase, setPhase] = useState('idle'); // idle | connecting | connected
  const [view, setView] = useState('home');
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
    setView('home');
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

  if (phase !== 'connected' || !overview) {
    return (
      <div className="auth-wrap">
        <AuthCard
          initialSession={session}
          error={authError}
          connecting={phase === 'connecting'}
          onConnect={connect}
        />
      </div>
    );
  }

  const pageMeta = view === 'home' ? homePageMeta() : PAGE_TITLES[view];

  return (
    <div className="app">
      <Sidebar view={view} onNavigate={setView} onDisconnect={disconnect} />

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1 className="page-title">{pageMeta.title}</h1>
              <p className="page-sub">{pageMeta.sub}</p>
            </div>
            <div className="page-actions">
              <span className="pill live">
                <span className="dot" aria-hidden="true" />
                Live
              </span>
              {lastUpdated && (
                <span className="hint" title={new Date(lastUpdated).toLocaleString()}>
                  {relativeTime(lastUpdated)}
                </span>
              )}
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
            </div>
          </div>

          {view === 'home' && (
            <HomeView overview={overview} activity={activity} onNavigate={setView} />
          )}

          {view === 'activity' && (
            <ActivitySection entries={activity} persistent={overview.database === 'mongodb'} />
          )}

          {view === 'automations' && rules && (
            <>
              <ExamplesSection rules={rules} />
              <RulesSection rules={rules} />
            </>
          )}

          {view === 'setup' && <StatusSection overview={overview} />}
        </div>
      </div>
    </div>
  );
}
