import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Brand, Spinner, Alert, Badge } from '../components/ui';
import ResultBars from '../components/ResultBars';

// Public, unauthenticated live-results view.
export default function PublicResults() {
  const [elections, setElections] = useState([]);
  const [electionId, setElectionId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // /elections requires auth; the live tally does not. Fall back gracefully.
    api
      .get('/elections')
      .then((list) => {
        setElections(list);
        if (list[0]) setElectionId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!electionId) return;
    setError('');
    api.get(`/results/live?electionId=${electionId}`).then(setData).catch((e) => setError(e.message));
  }, [electionId]);

  const election = elections.find((e) => e._id === electionId);

  return (
    <div className="shell">
      <div className="tricolour" />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/"><Brand /></Link>
          <div className="topbar-spacer" />
          <Link className="btn secondary sm" to="/">Home</Link>
        </div>
      </header>

      <main className="content" style={{ maxWidth: 760 }}>
        <h1>Live results</h1>
        <p className="muted">Provisional valid-vote tallies. Final results are certified by ELECAM.</p>

        {loading ? (
          <Spinner />
        ) : (
          <>
            {elections.length > 0 && (
              <div className="field" style={{ maxWidth: 360 }}>
                <label>Election</label>
                <select className="input" value={electionId} onChange={(e) => setElectionId(e.target.value)}>
                  {elections.map((e) => (
                    <option key={e._id} value={e._id}>{e.title}</option>
                  ))}
                </select>
              </div>
            )}
            {elections.length === 0 && (
              <Alert type="info">
                Sign in to browse elections. A public tally is shown once an election ID is known.
              </Alert>
            )}

            <Alert type="error">{error}</Alert>

            {data && (
              <div className="card">
                <div className="card-head">
                  <h2>{election?.title || 'Results'}</h2>
                  {election && <Badge>{election.status}</Badge>}
                </div>
                <p className="muted">Total valid votes: <b>{data.totalValidVotes}</b></p>
                <ResultBars rows={data.results} />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>NOVS-CMR · ELECAM</span>
          <span className="topbar-spacer" />
          <span>Peace · Work · Fatherland</span>
        </div>
      </footer>
    </div>
  );
}
