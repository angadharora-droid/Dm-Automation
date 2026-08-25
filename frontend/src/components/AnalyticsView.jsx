import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChartColumn,
  Inbox,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import BarChart from './BarChart.jsx';

/** Fixed series order + palette validated on the white surface. */
const SERIES = [
  { label: 'Comments received', color: '#6228d7', value: (d) => d.commentsReceived ?? 0 },
  { label: 'DMs received', color: '#ee2a7b', value: (d) => d.messagesReceived ?? 0 },
  {
    label: 'Replies sent',
    color: '#1570ef',
    value: (d) => (d.dmsSent ?? 0) + (d.publicRepliesSent ?? 0),
  },
];

const RANGES = [7, 14, 30];

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="label">
        <Icon size={13} aria-hidden="true" />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function AnalyticsView({ fetchApi }) {
  const [range, setRange] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (days) => {
      setLoading(true);
      setError('');
      try {
        setData(await fetchApi(`/api/dashboard/analytics?days=${days}`));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [fetchApi],
  );

  useEffect(() => {
    load(range);
  }, [load, range]);

  const days = data?.days ?? [];
  const periodTotal = (value) => days.reduce((sum, day) => sum + value(day), 0);
  const totalEvents = SERIES.reduce((sum, s) => sum + periodTotal(s.value), 0);
  const errorsTotal = periodTotal((d) => d.errors ?? 0);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>
            <ChartColumn size={17} aria-hidden="true" />
            Last {range} days
          </h2>
          <div className="seg-control" role="group" aria-label="Date range">
            {RANGES.map((value) => (
              <button
                key={value}
                type="button"
                className={value === range ? 'active' : ''}
                onClick={() => setRange(value)}
              >
                {value}d
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="banner error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
            <button type="button" className="link-btn" onClick={() => load(range)}>
              Retry
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="empty-state">
            <Loader2 size={26} className="spin" aria-hidden="true" />
            <p>Loading analytics…</p>
          </div>
        ) : (
          data && (
            <>
              <div className="grid" style={{ marginBottom: 18 }}>
                <Stat icon={MessageCircle} label="Comments" value={periodTotal(SERIES[0].value)} />
                <Stat icon={Inbox} label="DMs received" value={periodTotal(SERIES[1].value)} />
                <Stat icon={Send} label="Replies sent" value={periodTotal(SERIES[2].value)} tone="ok" />
                <Stat
                  icon={AlertTriangle}
                  label="Errors"
                  value={errorsTotal}
                  tone={errorsTotal > 0 ? 'err' : undefined}
                />
              </div>

              {totalEvents === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">
                    <ChartColumn size={26} strokeWidth={1.8} />
                  </span>
                  <strong>No events in this period yet</strong>
                  <p>Once comments and DMs start flowing, the daily breakdown appears here.</p>
                </div>
              ) : (
                <>
                  <BarChart days={days} series={SERIES} />
                  <details className="chart-table">
                    <summary>View as table</summary>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            {SERIES.map((s) => (
                              <th scope="col" key={s.label}>
                                {s.label}
                              </th>
                            ))}
                            <th scope="col">Errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((day) => (
                            <tr key={day.date}>
                              <td className="time">{day.date}</td>
                              {SERIES.map((s) => (
                                <td key={s.label}>{s.value(day)}</td>
                              ))}
                              <td>{day.errors ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </>
          )
        )}
      </section>
    </>
  );
}
