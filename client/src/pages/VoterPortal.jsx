import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Brand, Alert, Spinner, Badge } from '../components/ui';
import FacialCapture from '../components/FacialCapture';

const STEPS = ['Identity', 'Verification', 'Ballot', 'Confirmation'];

export default function VoterPortal() {
  const { voter, logout, refresh } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState(null);
  const [status, setStatus] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [ballotToken, setBallotToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const elections = await api.get('/elections?status=OPEN');
      const open = elections[0];
      setElection(open);
      if (!open) {
        setLoading(false);
        return;
      }
      const [st, cands] = await Promise.all([
        api.get(`/votes/status?electionId=${open._id}`),
        api.get(`/candidates?election=${open._id}&status=APPROVED`),
      ]);
      setStatus(st);
      setCandidates(cands);
      if (st.hasVoted) setStep(3);
      else if (st.biometricStatus === 'VERIFIED') setStep(2);
      else setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onScan(result) {
    if (result?.scan?.status === 'PASS') {
      setStatus((s) => ({ ...s, biometricStatus: 'VERIFIED', eligible: true }));
      refresh();
      setTimeout(() => setStep(2), 800);
    }
  }

  async function castVote() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const out = await api.post('/votes/cast', {
        electionId: election._id,
        candidateId: selected,
      });
      setBallotToken(out.ballotToken);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
          <div className="topbar-spacer" />
          <div className="userchip">
            <div style={{ textAlign: 'right' }}>
              <div>{voter?.fullName}</div>
              <div className="role">{voter?.voterNumber}</div>
            </div>
            <button className="btn secondary sm" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="content" style={{ maxWidth: 720 }}>
        {loading ? (
          <Spinner label="Loading your ballot…" />
        ) : !election ? (
          <div className="card">
            <h2>No open election</h2>
            <p className="muted">There is currently no election open for voting. Please check back later.</p>
          </div>
        ) : (
          <>
            <div className="steps">
              {STEPS.map((label, i) => (
                <div key={label} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                  <span className="num">{i < step ? '✓' : i + 1}</span>
                  {label}
                </div>
              ))}
            </div>

            <Alert type="error">{error}</Alert>

            <div className="card">
              <div className="card-head">
                <h2>{election.title}</h2>
                <Badge>{election.status}</Badge>
              </div>

              {step === 0 && (
                <Identity voter={voter} status={status} onNext={() => setStep(1)} />
              )}

              {step === 1 && (
                <>
                  <p className="muted">
                    Before voting, confirm your identity with a quick facial scan
                    (Amazon Rekognition). Look into the camera in good lighting.
                  </p>
                  <FacialCapture onResult={onScan} />
                </>
              )}

              {step === 2 && (
                <>
                  <p className="muted">Select one candidate, then confirm your choice. Your ballot is anonymous.</p>
                  <div className="ballot">
                    {candidates.map((c) => (
                      <div
                        key={c._id}
                        className={`ballot-option ${selected === c._id ? 'selected' : ''}`}
                        onClick={() => setSelected(c._id)}
                      >
                        <div className="avatar">{c.candidateNumber?.replace('C-', '')}</div>
                        <div className="who">
                          <b>{c.voter?.fullName || 'Candidate'}</b>
                          <span>{c.party?.acronym || 'Independent'} · {c.candidateNumber}</span>
                        </div>
                        <div className="pick" />
                      </div>
                    ))}
                    {candidates.length === 0 && <p className="muted">No approved candidates yet.</p>}
                  </div>
                  <button
                    className="btn block"
                    style={{ marginTop: 16 }}
                    disabled={!selected || busy}
                    onClick={castVote}
                  >
                    {busy ? 'Submitting…' : 'Confirm & cast vote'}
                  </button>
                </>
              )}

              {step === 3 && (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                  <div style={{ fontSize: 52 }}>🗳️</div>
                  <h2 style={{ marginTop: 6 }}>
                    {ballotToken ? 'Vote recorded' : 'You have already voted'}
                  </h2>
                  <p className="muted">
                    {ballotToken
                      ? 'Thank you for voting. Your ballot was recorded anonymously.'
                      : 'Our records show you have already participated in this election.'}
                  </p>
                  {ballotToken && (
                    <p>
                      Ballot reference:{' '}
                      <span className="mono badge green">{ballotToken}</span>
                    </p>
                  )}
                  <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => navigate('/results')}>
                    View live results
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Identity({ voter, status, onNext }) {
  return (
    <>
      <div className="grid cols-2">
        <Field label="Full name" value={voter?.fullName} />
        <Field label="Voter number" value={voter?.voterNumber} />
        <Field label="Biometric status" value={<Badge>{status?.biometricStatus}</Badge>} />
        <Field label="Eligibility" value={<Badge>{status?.eligible ? 'ELIGIBLE' : 'PENDING'}</Badge>} />
      </div>
      <button className="btn" style={{ marginTop: 14 }} onClick={onNext}>
        Continue
      </button>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="label muted" style={{ fontSize: '.78rem' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
