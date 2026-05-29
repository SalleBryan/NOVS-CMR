import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Brand } from './ui';

// Navigation entries gated by role. SYSTEM_ADMIN sees everything.
const NAV = [
  { to: '/app', label: 'Dashboard', end: true, roles: '*' },
  { to: '/app/voters', label: 'Voters', roles: ['REGISTRATION_OFFICER', 'ELECTORAL_ADMIN', 'POLLING_OFFICIAL'] },
  { to: '/app/elections', label: 'Elections', roles: ['ELECTORAL_ADMIN'] },
  { to: '/app/candidates', label: 'Candidates', roles: ['ELECTORAL_ADMIN', 'REGISTRATION_OFFICER'] },
  { to: '/app/stations', label: 'Polling Stations', roles: ['ELECTORAL_ADMIN', 'POLLING_OFFICIAL'] },
  { to: '/app/results', label: 'Results', roles: ['ELECTORAL_ADMIN', 'POLLING_OFFICIAL', 'AUDIT_REVIEWER'] },
  { to: '/app/blockchain', label: 'Ledger', roles: ['ELECTORAL_ADMIN', 'AUDIT_REVIEWER'] },
  { to: '/app/audit', label: 'Audit', roles: ['ELECTORAL_ADMIN', 'AUDIT_REVIEWER'] },
  { to: '/app/users', label: 'Users', roles: ['SYSTEM_ADMIN'] },
];

function allowed(entry, role) {
  if (entry.roles === '*') return true;
  if (role === 'SYSTEM_ADMIN') return true;
  return entry.roles.includes(role);
}

export default function Layout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="shell">
      <div className="tricolour" />
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="nav">
            {NAV.filter((n) => allowed(n, role)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-spacer" />
          <div className="userchip">
            <div style={{ textAlign: 'right' }}>
              <div>{user?.fullName || user?.username}</div>
              <div className="role">{role?.replace('_', ' ')}</div>
            </div>
            <button className="btn secondary sm" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>NOVS-CMR · ELECAM · Republic of Cameroon</span>
          <span className="topbar-spacer" />
          <span>Peace · Work · Fatherland</span>
        </div>
      </footer>
    </div>
  );
}
