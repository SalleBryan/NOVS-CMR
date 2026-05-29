import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PageHead, Spinner, Alert, Badge } from '../../components/ui';
import FacialCapture from '../../components/FacialCapture';

export default function VoterDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const [voter, setVoter] = useState(null);
  const [error, setError] = useState('');
  const [showScan, setShowScan] = useState(false);

  const canVerify = ['REGISTRATION_OFFICER', 'ELECTORAL_ADMIN', 'SYSTEM_ADMIN'].includes(role);
  const canLock = ['ELECTORAL_ADMIN', 'SYSTEM_ADMIN'].includes(role);

  async function load() {
    setError('');
    try {
      setVoter(await api.get(`/voters/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function toggleLock() {
    try {
      await api.post(`/voters/${id}/${voter.accountLocked ? 'unlock' : 'lock'}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!voter) return error ? <Alert type="error">{error}</Alert> : <Spinner />;

  return (
    <>
      <PageHead
        title={voter.fullName}
        subtitle={`${voter.voterNumber} · ${voter.nationalIdNumber}`}
        actions={
          <>
            <Link className="btn secondary" to="/app/voters">Back</Link>
            {canLock && (
              <button className={`btn ${voter.accountLocked ? '' : 'danger'}`} onClick={toggleLock}>
                {voter.accountLocked ? 'Unlock account' : 'Lock account'}
              </button>
            )}
          </>
        }
      />
      <Alert type="error">{error}</Alert>

      <div className="grid cols-2">
        <div className="card">
          <h3>Profile</h3>
          <div className="grid cols-2">
            <Info label="Biometric status" value={<Badge>{voter.biometricStatus}</Badge>} />
            <Info label="Account" value={<Badge>{voter.accountLocked ? 'LOCKED' : 'ACTIVE'}</Badge>} />
            <Info label="District" value={voter.district?.name} />
            <Info label="Polling station" value={voter.pollingStation?.name} />
            <Info label="Gender" value={voter.gender} />
            <Info label="Occupation" value={voter.occupation} />
            <Info label="Place of birth" value={voter.placeOfBirth} />
            <Info label="Registered" value={new Date(voter.registrationDate).toLocaleDateString()} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Biometric verification</h3>
            {canVerify && (
              <button className="btn sm" onClick={() => setShowScan((s) => !s)}>
                {showScan ? 'Close' : 'New facial scan'}
              </button>
            )}
          </div>

          {showScan && (
            <div style={{ marginBottom: 14 }}>
              <FacialCapture voterId={voter._id} onResult={() => setTimeout(load, 600)} />
            </div>
          )}

          {voter.facialVerifications?.length ? (
            <table className="table">
              <thead>
                <tr><th>Session</th><th>Liveness</th><th>Quality</th><th>Result</th><th>When</th></tr>
              </thead>
              <tbody>
                {voter.facialVerifications.map((f) => (
                  <tr key={f._id}>
                    <td className="mono">{f.sessionId}</td>
                    <td>{Math.round(f.livenessScore)}</td>
                    <td>{Math.round(f.similarityScore)}</td>
                    <td><Badge>{f.status}</Badge></td>
                    <td>{new Date(f.capturedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No facial verifications recorded yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: '.76rem' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}
