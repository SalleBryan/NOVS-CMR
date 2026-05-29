import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Brand, Alert } from '../components/ui';

export default function StaffLogin() {
  const { staffLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await staffLogin(username.trim(), password);
      navigate('/app');
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
            <h2>Staff sign in</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              Administrators, officers, polling officials and auditors.
            </p>
            <Alert type="error">{error}</Alert>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label>Username</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin.electoral"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button className="btn block" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
          <div className="auth-switch">
            Are you a voter? <Link to="/login/voter">Vote here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
