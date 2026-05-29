import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';

export default function Users() {
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [stations, setStations] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', roleName: '', pollingStation: '' });

  async function load() {
    setError('');
    try {
      const [u, r, s] = await Promise.all([api.get('/users'), api.get('/users/roles'), api.get('/stations')]);
      setUsers(u); setRoles(r); setStations(s);
      if (!form.roleName && r[0]) setForm((f) => ({ ...f, roleName: r[0].roleName }));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      const payload = { ...form };
      if (!payload.pollingStation) delete payload.pollingStation;
      await api.post('/users', payload);
      setMsg(`Created user ${form.username}`);
      setShowForm(false);
      setForm({ username: '', password: '', fullName: '', email: '', roleName: roles[0]?.roleName || '', pollingStation: '' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function act(id, action) {
    try { await api.post(`/users/${id}/${action}`); load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <>
      <PageHead
        title="User accounts"
        subtitle="Create staff accounts, assign roles, and lock or disable access."
        actions={<button className="btn" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New user'}</button>}
      />
      <Alert type="error">{error}</Alert>
      <Alert type="success">{msg}</Alert>

      {showForm && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <h3>New staff account</h3>
          <div className="row">
            <div className="field"><label>Username *</label><input className="input" value={form.username} onChange={set('username')} required /></div>
            <div className="field"><label>Password *</label><input className="input" type="password" value={form.password} onChange={set('password')} required /></div>
          </div>
          <div className="row">
            <div className="field"><label>Full name</label><input className="input" value={form.fullName} onChange={set('fullName')} /></div>
            <div className="field"><label>Email</label><input className="input" value={form.email} onChange={set('email')} /></div>
          </div>
          <div className="row">
            <div className="field">
              <label>Role *</label>
              <select className="input" value={form.roleName} onChange={set('roleName')} required>
                {roles.map((r) => <option key={r._id} value={r.roleName}>{r.roleName}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Polling station (optional)</label>
              <select className="input" value={form.pollingStation} onChange={set('pollingStation')}>
                <option value="">—</option>
                {stations.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.stationCode})</option>)}
              </select>
            </div>
          </div>
          <button className="btn">Create account</button>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        {!users ? <Spinner /> : users.length === 0 ? <Empty>No users.</Empty> : (
          <table className="table">
            <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Station</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="mono">{u.username}</td>
                  <td>{u.fullName || '—'}</td>
                  <td>{u.role?.roleName}</td>
                  <td className="muted">{u.pollingStation?.stationCode || '—'}</td>
                  <td><Badge>{u.status}</Badge></td>
                  <td>
                    <div className="toolbar" style={{ margin: 0 }}>
                      {u.status === 'LOCKED' || u.status === 'DISABLED' ? (
                        <button className="btn sm" onClick={() => act(u._id, 'unlock')}>Reactivate</button>
                      ) : (
                        <>
                          <button className="btn sm secondary" onClick={() => act(u._id, 'lock')}>Lock</button>
                          <button className="btn sm danger" onClick={() => act(u._id, 'disable')}>Disable</button>
                        </>
                      )}
                    </div>
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
