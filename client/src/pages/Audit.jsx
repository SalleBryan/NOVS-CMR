import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';

export default function Audit() {
  const [logs, setLogs] = useState(null);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const p = new URLSearchParams();
      if (actor) p.set('actor', actor);
      if (action) p.set('action', action);
      setLogs(await api.get(`/audit?${p.toString()}`));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHead title="Audit log" subtitle="Traceability of role-sensitive actions across the platform." />
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 200 }} placeholder="Actor…" value={actor} onChange={(e) => setActor(e.target.value)} />
        <input className="input" style={{ maxWidth: 220 }} placeholder="Action contains…" value={action} onChange={(e) => setAction(e.target.value)} />
        <button className="btn secondary" onClick={load}>Filter</button>
      </div>
      <Alert type="error">{error}</Alert>

      <div className="card" style={{ padding: 0 }}>
        {!logs ? <Spinner /> : logs.length === 0 ? <Empty>No audit entries.</Empty> : (
          <table className="table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Outcome</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="muted" style={{ fontSize: '.8rem' }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="mono">{l.actor}</td>
                  <td>{l.action}</td>
                  <td className="muted">{l.entityType || '—'}</td>
                  <td><Badge>{l.outcome}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
