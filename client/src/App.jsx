import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Landing from './pages/Landing';
import StaffLogin from './pages/StaffLogin';
import VoterLogin from './pages/VoterLogin';
import PublicResults from './pages/PublicResults';

import Dashboard from './pages/Dashboard';
import VotersList from './pages/voters/VotersList';
import VoterRegister from './pages/voters/VoterRegister';
import VoterDetail from './pages/voters/VoterDetail';
import Elections from './pages/Elections';
import Candidates from './pages/Candidates';
import Stations from './pages/Stations';
import Results from './pages/Results';
import Ledger from './pages/Ledger';
import Audit from './pages/Audit';
import Users from './pages/Users';

import VoterPortal from './pages/VoterPortal';

const STAFF = 'staff';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login/staff" element={<StaffLogin />} />
      <Route path="/login/voter" element={<VoterLogin />} />
      <Route path="/results" element={<PublicResults />} />

      {/* Voter portal */}
      <Route
        path="/vote"
        element={
          <ProtectedRoute kind="voter">
            <VoterPortal />
          </ProtectedRoute>
        }
      />

      {/* Staff application */}
      <Route
        path="/app"
        element={
          <ProtectedRoute kind={STAFF}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="voters"
          element={
            <ProtectedRoute kind={STAFF} roles={['REGISTRATION_OFFICER', 'ELECTORAL_ADMIN', 'POLLING_OFFICIAL']}>
              <VotersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="voters/new"
          element={
            <ProtectedRoute kind={STAFF} roles={['REGISTRATION_OFFICER', 'ELECTORAL_ADMIN']}>
              <VoterRegister />
            </ProtectedRoute>
          }
        />
        <Route
          path="voters/:id"
          element={
            <ProtectedRoute kind={STAFF} roles={['REGISTRATION_OFFICER', 'ELECTORAL_ADMIN', 'POLLING_OFFICIAL']}>
              <VoterDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="elections"
          element={
            <ProtectedRoute kind={STAFF} roles={['ELECTORAL_ADMIN']}>
              <Elections />
            </ProtectedRoute>
          }
        />
        <Route
          path="candidates"
          element={
            <ProtectedRoute kind={STAFF} roles={['ELECTORAL_ADMIN', 'REGISTRATION_OFFICER']}>
              <Candidates />
            </ProtectedRoute>
          }
        />
        <Route
          path="stations"
          element={
            <ProtectedRoute kind={STAFF} roles={['ELECTORAL_ADMIN', 'POLLING_OFFICIAL']}>
              <Stations />
            </ProtectedRoute>
          }
        />
        <Route
          path="results"
          element={
            <ProtectedRoute kind={STAFF} roles={['ELECTORAL_ADMIN', 'POLLING_OFFICIAL', 'AUDIT_REVIEWER']}>
              <Results />
            </ProtectedRoute>
          }
        />
        <Route
          path="blockchain"
          element={
            <ProtectedRoute kind={STAFF} roles={['ELECTORAL_ADMIN', 'AUDIT_REVIEWER']}>
              <Ledger />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute kind={STAFF} roles={['ELECTORAL_ADMIN', 'AUDIT_REVIEWER']}>
              <Audit />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute kind={STAFF} roles={['SYSTEM_ADMIN']}>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
