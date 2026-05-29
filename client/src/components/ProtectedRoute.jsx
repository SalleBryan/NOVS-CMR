import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from './ui';

/**
 * Guards routes by identity kind and (optionally) staff role.
 *   <ProtectedRoute kind="staff" roles={['ELECTORAL_ADMIN']}>...
 *   <ProtectedRoute kind="voter">...
 */
export default function ProtectedRoute({ kind, roles, children }) {
  const { identity, loading, role } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading session..." />;

  if (!identity) {
    const to = kind === 'voter' ? '/login/voter' : '/login/staff';
    return <Navigate to={to} state={{ from: location }} replace />;
  }

  if (kind && identity.kind !== kind) {
    return <Navigate to={identity.kind === 'voter' ? '/vote' : '/app'} replace />;
  }

  if (roles && role !== 'SYSTEM_ADMIN' && !roles.includes(role)) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
        <h2>Access restricted</h2>
        <p className="muted">
          Your role ({role?.replace('_', ' ')}) does not have access to this area.
        </p>
      </div>
    );
  }

  return children;
}
