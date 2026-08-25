import {
  AlertTriangle,
  Inbox,
  ListOrdered,
  MessageCircle,
  Send,
  Webhook,
  Zap,
} from 'lucide-react';
import { relativeTime } from '../utils.js';

const TYPE_META = {
  webhook: { icon: Webhook, label: 'webhook' },
  comment: { icon: MessageCircle, label: 'comment' },
  message: { icon: Send, label: 'message' },
  automation: { icon: Zap, label: 'automation' },
  error: { icon: AlertTriangle, label: 'error' },
};

function TypeBadge({ type }) {
  const meta = TYPE_META[type] ?? TYPE_META.webhook;
  const Icon = meta.icon;
  return (
    <span className={`type-badge ${type}`}>
      <Icon size={12} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function ActivitySection({ entries, persistent, limit, onViewAll }) {
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <ListOrdered size={17} aria-hidden="true" />
          Recent activity
        </h2>
        {onViewAll && entries.length > 0 ? (
          <button type="button" className="link-btn" onClick={onViewAll}>
            View all
          </button>
        ) : (
          <span className="hint">
            {persistent ? 'Stored in MongoDB · kept 7 days' : 'In-memory · cleared on restart'}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <Inbox size={26} strokeWidth={1.8} />
          </span>
          <strong>No activity yet</strong>
          <p>
            Comment <code>PRICE</code> on one of your posts from a tester account, or send your
            account a DM — events will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Type</th>
                <th scope="col">Event</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => (
                <tr key={entry.id}>
                  <td className="time" title={new Date(entry.timestamp).toLocaleString()}>
                    {relativeTime(entry.timestamp)}
                  </td>
                  <td>
                    <TypeBadge type={entry.type} />
                  </td>
                  <td>{entry.message}</td>
                  <td className="meta-cell">{entry.meta ? JSON.stringify(entry.meta) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
