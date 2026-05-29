import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';

const TYPES = ['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL', 'REGIONAL', 'SENATORIAL'];
const STATUSES = ['DRAFT', 'NOMINATION', 'SCHEDULED', 'OPEN', 'CLOSED', 'PUBLISHED'];

export default function Elections() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    electionCode: '', title: '', type: 'PRESIDENTIAL', startDate: '', endDate: '', status: 'DRAFT',
  });

  async function load() {
    setError('');
    try { setList(await api.get('/elections')); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/elections', form);
      setShowForm(false);
      setForm({ electionCode: '', title: '', type: 'PRESIDENTIAL', startDate: '', endDate: '', status: 'DRAFT' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function changeStatus(id, status) {
    try { await api.patch(`/elections/${id}`, { status }); load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <>
      <PageHead
        title="Elections"
        subtitle="Create and configure elections; open and close voting windows."
        actions={<button className="btn" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New election'}</button>}
      />
      <Alert type="error">{error}</Alert>

      {showForm && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <h3>New election</h3>
          <div className="row">
            <div className="field"><label>Election code *</label><input className="input" value={form.electionCode} onChange={set('electionCode')} placeholder="e.g. LEG-2026" required /></div>
            <div className="field"><label>Title *</label><input className="input" value={form.title} onChange={set('title')} required /></div>
          </div>
          <div className="row">
            <div className="field"><label>Type</label><select className="input" value={form.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Start date *</label><input className="input" type="datetime-local" value={form.startDate} onChange={set('startDate')} required /></div>
            <div className="field"><label>End date *</label><input className="input" type="datetime-local" value={form.endDate} onChange={set('endDate')} required /></div>
            <div className="field"><label>Status</label><select className="input" value={form.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <button className="btn">Create election</button>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        {!list ? <Spinner /> : list.length === 0 ? <Empty>No elections configured.</Empty> : (
          <table className="table">
            <thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Window</th><th>Status</th><th>Change status</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e._id}>
                  <td className="mono">{e.electionCode}</td>
                  <td>{e.title}</td>
                  <td>{e.type}</td>
                  <td className="muted" style={{ fontSize: '.82rem' }}>
                    {new Date(e.startDate).toLocaleDateString()} – {new Date(e.endDate).toLocaleDateString()}
                  </td>
                  <td><Badge>{e.status}</Badge></td>
                  <td>
                    <select className="input" style={{ padding: '5px 8px', maxWidth: 150 }} value={e.status} onChange={(ev) => changeStatus(e._id, ev.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
