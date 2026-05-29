import { Empty } from './ui';

// Horizontal bar chart for candidate tallies.
export default function ResultBars({ rows }) {
  if (!rows || rows.length === 0) return <Empty>No votes recorded yet.</Empty>;
  return (
    <div>
      {rows.map((r) => (
        <div className="result-row" key={r.candidateId}>
          <div className="meta">
            <span>
              <b>{r.name}</b> <span className="muted">· {r.party}</span>
            </span>
            <span>
              <b>{r.votes}</b> <span className="muted">({r.percentage}%)</span>
            </span>
          </div>
          <div className="result-bar">
            <span style={{ width: `${r.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
