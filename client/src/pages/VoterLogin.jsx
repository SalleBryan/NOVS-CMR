import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Brand, Alert } from '../components/ui';

export default function VoterLogin() {
  const { voterLogin } = useAuth();
  const navigate = useNavigate();
  const [voterNumber, setVoterNumber] = useState('');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await voterLogin(voterNumber.trim(), nationalIdNumber.trim());
      navigate('/vote');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="tricolour" />
      <div className="center-wrap">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <Brand />
          </div>
          <div className="card">
            <h2>Voter sign in</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              Use the voter number and national ID printed on your voter card.
            </p>
            <Alert type="error">{error}</Alert>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label>Voter number</label>
                <input
                  className="input"
                  value={voterNumber}
                  onChange={(e) => setVoterNumber(e.target.value)}
                  placeholder="e.g. V-1009"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>National ID number</label>
                <input
                  className="input"
                  value={nationalIdNumber}
                  onChange={(e) => setNationalIdNumber(e.target.value)}
                  placeholder="e.g. NID-50009"
                />
              </div>
              <button className="btn block" disabled={busy}>
                {busy ? 'Verifying…' : 'Continue'}
              </button>
            </form>
          </div>
          <div className="auth-switch">
            Election official? <Link to="/login/staff">Staff portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
