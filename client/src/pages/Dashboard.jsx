import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Stat, Spinner, PageHead, Alert } from '../components/ui';

const ROLE_BLURB = {
  SYSTEM_ADMIN: 'Platform administration — accounts, roles, monitoring and audit visibility.',
  ELECTORAL_ADMIN: 'Election configuration, candidate review, and result publication.',
  REGISTRATION_OFFICER: 'Voter enrolment and biometric capture.',
  POLLING_OFFICIAL: 'Operations for your assigned polling station.',
  AUDIT_REVIEWER: 'Read-only review of audit logs and the blockchain ledger.',
};

const QUICK = {
  SYSTEM_ADMIN: [['Manage users', '/app/users'], ['Audit log', '/app/audit'], ['Ledger', '/app/blockchain']],
  ELECTORAL_ADMIN: [['Elections', '/app/elections'], ['Review candidates', '/app/candidates'], ['Publish results', '/app/results']],
  REGISTRATION_OFFICER: [['Register a voter', '/app/voters/new'], ['Voter register', '/app/voters']],
  POLLING_OFFICIAL: [['My station', '/app/stations'], ['Station register', '/app/voters']],
  AUDIT_REVIEWER: [['Audit log', '/app/audit'], ['Ledger', '/app/blockchain'], ['Results', '/app/results']],
};

export default function Dashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <PageHead
        title={`Welcome, ${user?.fullName || user?.username}`}
        subtitle={ROLE_BLURB[role] || 'NOVS-CMR control panel.'}
      />
      <Alert type="error">{error}</Alert>

      {!stats ? (
        <Spinner />
      ) : (
        <>
          <div className="grid cols-4">
            <Stat value={stats.voters} label="Registered voters" />
            <Stat value={stats.verifiedVoters} label="Biometric verified" tone="alt" />
            <Stat value={stats.candidates} label="Candidates" />
            <Stat value={stats.pendingCandidates} label="Awaiting review" tone="warn" />
            <Stat value={stats.elections} label="Elections" />
            <Stat value={stats.openElections} label="Open now" tone="alt" />
            <Stat value={stats.ballots} label="Ballots cast" />
            <Stat value={stats.blockchainRecords} label="Ledger records" />
          </div>

          {stats.stationVoters != null && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Your station</h3>
              <p className="muted">{stats.stationVoters} voters registered at your assigned polling station.</p>
            </div>
          )}

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Quick actions</h3>
            <div className="toolbar" style={{ margin: '8px 0 0' }}>
              {(QUICK[role] || []).map(([label, to]) => (
                <Link key={to} to={to} className="btn secondary">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
