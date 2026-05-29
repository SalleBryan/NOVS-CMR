import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PageHead, Spinner, Alert, Badge, Empty } from '../../components/ui';

export default function VotersList() {
  const { role } = useAuth();
  const [voters, setVoters] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canRegister = role === 'REGISTRATION_OFFICER' || role === 'ELECTORAL_ADMIN' || role === 'SYSTEM_ADMIN';

  async function load() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('biometricStatus', status);
      setVoters(await api.get(`/voters?${params.toString()}`));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <>
      <PageHead
        title="Voter register"
        subtitle="Search and manage registered voters."
        actions={canRegister && <Link className="btn" to="/app/voters/new">+ Register voter</Link>}
      />

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search name, voter no. or NID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All biometric statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="FAILED">Failed</option>
        </select>
        <button className="btn secondary" onClick={load}>Search</button>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="card" style={{ padding: 0 }}>
        {!voters ? (
          <Spinner />
        ) : voters.length === 0 ? (
          <Empty>No voters match your search.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Voter no.</th>
                <th>Name</th>
                <th>National ID</th>
                <th>Station</th>
                <th>Biometric</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {voters.map((v) => (
                <tr key={v._id}>
                  <td className="mono">{v.voterNumber}</td>
                  <td>{v.fullName}</td>
                  <td className="mono">{v.nationalIdNumber}</td>
                  <td>{v.pollingStation?.name || '—'}</td>
                  <td><Badge>{v.biometricStatus}</Badge></td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn secondary sm" to={`/app/voters/${v._id}`}>Open</Link>
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
