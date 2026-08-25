export default function ActivitySection({ entries, persistent }) {
  return (
    <section className="card">
      <h2>Recent activity</h2>
      <p className="hint">
        {persistent
          ? 'Stored in MongoDB — entries expire automatically after 7 days.'
          : 'In-memory feed — cleared on every restart/redeploy (set MONGODB_URI to persist).'}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Event</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="hint">
                  No activity yet.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                <td className={`type-${entry.type}`}>{entry.type}</td>
                <td>{entry.message}</td>
                <td className="hint">{entry.meta ? JSON.stringify(entry.meta) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
