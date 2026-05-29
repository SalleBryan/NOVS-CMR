import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';

const STATUSES = ['CLOSED', 'OPEN', 'COUNTING', 'SEALED'];

export default function Stations() {
  const { role } = useAuth();
  const isAdmin = role === 'ELECTORAL_ADMIN' || role === 'SYSTEM_ADMIN';
  const isOfficial = role === 'POLLING_OFFICIAL';

  const [list, setList] = useState(null);
  const [elections, setElections] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [reportFor, setReportFor] = useState(null);

  async function load() {
    setError('');
    try {
      const [stations, es] = await Promise.all([api.get('/stations'), api.get('/elections')]);
      setList(stations);
      setElections(es);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    try { await api.patch(`/stations/${id}`, { status }); load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <>
      <PageHead
        title={isOfficial ? 'My polling station' : 'Polling stations'}
        subtitle={isOfficial ? 'Operate your assigned station and submit the end-of-day report.' : 'Manage polling stations and their status.'}
      />
      <Alert type="error">{error}</Alert>
      <Alert type="success">{msg}</Alert>

      <div className="card" style={{ padding: 0 }}>
        {!list ? <Spinner /> : list.length === 0 ? <Empty>No stations.</Empty> : (
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>District</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s._id}>
                  <td className="mono">{s.stationCode}</td>
                  <td>{s.name}</td>
                  <td>{s.district?.name || '—'}</td>
                  <td>{s.registeredVoterCount}</td>
                  <td><Badge>{s.status}</Badge></td>
                  <td>
                    <div className="toolbar" style={{ margin: 0 }}>
                      {(isAdmin || isOfficial) && (
                        <select className="input" style={{ padding: '5px 8px', maxWidth: 130 }} value={s.status} onChange={(e) => setStatus(s._id, e.target.value)}>
                          {STATUSES.map((st) => <option key={st}>{st}</option>)}
                        </select>
                      )}
                      {(isOfficial || isAdmin) && (
                        <button className="btn sm secondary" onClick={() => setReportFor(s)}>Submit report</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reportFor && (
        <ReportModal
          station={reportFor}
          elections={elections}
          onClose={() => setReportFor(null)}
          onDone={(txRef) => { setReportFor(null); setMsg(`Report submitted · ledger ${txRef}`); load(); }}
          onError={setError}
        />
      )}
    </>
  );
}

function ReportModal({ station, elections, onClose, onDone, onError }) {
  const [form, setForm] = useState({ electionId: elections[0]?._id || '', totalVotes: '', validVotes: '', invalidVotes: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await api.post(`/stations/${station._id}/report`, {
        electionId: form.electionId,
        totalVotes: Number(form.totalVotes),
        validVotes: form.validVotes === '' ? undefined : Number(form.validVotes),
        invalidVotes: form.invalidVotes === '' ? undefined : Number(form.invalidVotes),
      });
      onDone(out.ledger?.txRef);
    } catch (err) { onError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16, maxWidth: 520 }}>
      <div className="card-head">
        <h3>End-of-day report · {station.stationCode}</h3>
        <button className="btn sm ghost" onClick={onClose}>Close</button>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Election</label>
          <select className="input" value={form.electionId} onChange={set('electionId')} required>
            {elections.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field"><label>Total votes</label><input className="input" type="number" min="0" value={form.totalVotes} onChange={set('totalVotes')} required /></div>
          <div className="field"><label>Valid</label><input className="input" type="number" min="0" value={form.validVotes} onChange={set('validVotes')} /></div>
          <div className="field"><label>Invalid</label><input className="input" type="number" min="0" value={form.invalidVotes} onChange={set('invalidVotes')} /></div>
        </div>
        <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit & anchor on ledger'}</button>
      </form>
    </div>
  );
}
