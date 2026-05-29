import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';

export default function Candidates() {
  const { role } = useAuth();
  const [elections, setElections] = useState([]);
  const [electionId, setElectionId] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const isAdmin = role === 'ELECTORAL_ADMIN' || role === 'SYSTEM_ADMIN';

  useEffect(() => {
    api.get('/elections').then((es) => {
      setElections(es);
      if (es[0]) setElectionId(es[0]._id);
    }).catch((e) => setError(e.message));
  }, []);

  async function load() {
    if (!electionId) return;
    setError('');
    try { setList(await api.get(`/candidates?election=${electionId}`)); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [electionId]);

  async function approve(id) {
    setMsg(''); setError('');
    try {
      const out = await api.post(`/candidates/${id}/approve`);
      setMsg(`Approved ${out.candidateNumber || ''} · ledger ${out.txRef || '(already approved)'}`);
      load();
    } catch (e) { setError(e.message); }
  }
  async function reject(id) {
    const reason = prompt('Reason for rejection?') || 'Not specified';
    setMsg(''); setError('');
    try {
      const out = await api.post(`/candidates/${id}/reject`, { reason });
      setMsg(`Rejected ${out.candidateNumber} · ledger ${out.ledger?.txRef}`);
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <PageHead title="Candidates" subtitle="Review nominations and approve or reject candidatures." />
      <div className="toolbar">
        <select className="input" style={{ maxWidth: 320 }} value={electionId} onChange={(e) => setElectionId(e.target.value)}>
          {elections.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
        </select>
      </div>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{msg}</Alert>

      <div className="card" style={{ padding: 0 }}>
        {!list ? <Spinner /> : list.length === 0 ? <Empty>No candidates for this election.</Empty> : (
          <table className="table">
            <thead><tr><th>No.</th><th>Candidate</th><th>Party</th><th>District</th><th>Status</th>{isAdmin && <th>Decision</th>}</tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td className="mono">{c.candidateNumber}</td>
                  <td>{c.voter?.fullName || '—'}</td>
                  <td>{c.party?.acronym || 'Independent'}</td>
                  <td>{c.district?.name || '—'}</td>
                  <td><Badge>{c.status}</Badge></td>
                  {isAdmin && (
                    <td>
                      {['SUBMITTED', 'UNDER_REVIEW'].includes(c.status) ? (
                        <div className="toolbar" style={{ margin: 0 }}>
                          <button className="btn sm" onClick={() => approve(c._id)}>Approve</button>
                          <button className="btn sm danger" onClick={() => reject(c._id)}>Reject</button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
