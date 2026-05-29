import { Link } from 'react-router-dom';
import { Brand } from '../components/ui';

export default function Landing() {
  return (
    <div className="shell">
      <div className="tricolour" />
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-spacer" />
          <Link className="btn secondary sm" to="/results">
            View public results
          </Link>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <span className="badge gold" style={{ marginBottom: 14 }}>★ Republic of Cameroon · ELECAM</span>
          <h1>National Online Voting System</h1>
          <p className="lead">
            A secure, role-based platform implementing the electoral workflow of Cameroon —
            voter registration, AI-assisted facial verification, online voting, and
            tamper-evident result publication.
          </p>
        </section>

        <div className="choice-grid">
          <Link to="/login/voter" className="choice">
            <span className="badge green">Voters</span>
            <h3 style={{ marginTop: 10 }}>Cast your vote</h3>
            <p>Sign in with your voter number and national ID to verify your identity and vote.</p>
          </Link>
          <Link to="/login/staff" className="choice">
            <span className="badge red">Officials</span>
            <h3 style={{ marginTop: 10 }}>Staff portal</h3>
            <p>Registration officers, electoral & system administrators, polling officials and auditors.</p>
          </Link>
        </div>

        <p className="muted" style={{ textAlign: 'center', marginTop: 30, fontSize: '.85rem' }}>
          Equal and secret ballot · Built on a MongoDB electoral database with a
          Hyperledger Fabric audit layer.
        </p>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>NOVS-CMR · University of Buea · CEF 476</span>
          <span className="topbar-spacer" />
          <span>Peace · Work · Fatherland</span>
        </div>
      </footer>
    </div>
  );
}
