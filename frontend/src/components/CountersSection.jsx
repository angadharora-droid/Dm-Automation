import {
  Activity,
  AlertTriangle,
  CopyX,
  Inbox,
  MessageCircle,
  Reply,
  Send,
  Webhook,
} from 'lucide-react';

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

export default function CountersSection({ counters = {} }) {
  const errors = counters.errors ?? 0;
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <Activity size={17} aria-hidden="true" />
          Counters
        </h2>
      </div>
      <div className="grid">
        <Stat icon={Webhook} label="Webhooks" value={counters.webhooksReceived ?? 0} />
        <Stat icon={MessageCircle} label="Comments" value={counters.commentsReceived ?? 0} />
        <Stat icon={Inbox} label="DMs received" value={counters.messagesReceived ?? 0} />
        <Stat icon={Send} label="DMs sent" value={counters.dmsSent ?? 0} tone="ok" />
        <Stat icon={Reply} label="Public replies" value={counters.publicRepliesSent ?? 0} tone="ok" />
        <Stat icon={CopyX} label="Duplicates skipped" value={counters.duplicatesSkipped ?? 0} />
        <Stat
          icon={AlertTriangle}
          label="Errors"
          value={errors}
          tone={errors > 0 ? 'err' : undefined}
        />
      </div>
    </section>
  );
}
