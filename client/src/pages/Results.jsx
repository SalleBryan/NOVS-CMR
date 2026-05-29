import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';
import ResultBars from '../components/ResultBars';

export default function Results() {
  const { role } = useAuth();
  const canPublish = role === 'ELECTORAL_ADMIN' || role === 'SYSTEM_ADMIN';

  const [elections, setElections] = useState([]);
  const [electionId, setElectionId] = useState('');
  const [live, setLive] = useState(null);
  const [stored, setStored] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/elections').then((es) => { setElections(es); if (es[0]) setElectionId(es[0]._id); })
      .catch((e) => setError(e.message));
  }, []);

  async function load() {
    if (!electionId) return;
    setError('');
    try {
      const [l, s] = await Promise.all([
        api.get(`/results/live?electionId=${electionId}`),
        api.get(`/results?electionId=${electionId}`),
      ]);
      setLive(l);
      setStored(s);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [electionId]);

  async function publish() {
    setBusy(true); setMsg(''); setError('');
    try {
      const out = await api.post('/results/publish', { electionId });
      setMsg(`Published national result for ${out.election} · ${out.totalValid} valid votes · ledger ${out.txRef}`);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const election = elections.find((e) => e._id === electionId);

  return (
    <>
      <PageHead
        title="Results"
        subtitle="Live tallies and certified result documents."
        actions={canPublish && <button className="btn" disabled={busy || !electionId} onClick={publish}>{busy ? 'Publishing…' : 'Publish national result'}</button>}
      />
      <div className="toolbar">
        <select className="input" style={{ maxWidth: 320 }} value={electionId} onChange={(e) => setElectionId(e.target.value)}>
          {elections.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
        </select>
      </div>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{msg}</Alert>

      {!live ? <Spinner /> : (
        <>
          <div className="card">
            <div className="card-head">
              <h3>Live tally</h3>
              {election && <Badge>{election.status}</Badge>}
            </div>
            <p className="muted">Total valid votes: <b>{live.totalValidVotes}</b></p>
            <ResultBars rows={live.results} />
          </div>

          <div className="card">
            <h3>Stored result documents</h3>
            {stored.length === 0 ? <Empty>No result documents yet. Publish to create the national result.</Empty> : (
              <table className="table">
                <thead><tr><th>Level</th><th>Scope</th><th>Valid</th><th>Invalid</th><th>Status</th></tr></thead>
                <tbody>
                  {stored.map((r) => (
                    <tr key={r._id}>
                      <td><Badge>{r.level}</Badge></td>
                      <td>{r.pollingStation?.name || r.district?.name || 'National'}</td>
                      <td>{r.totalValidVotes}</td>
                      <td>{r.totalInvalidVotes}</td>
                      <td><Badge>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
