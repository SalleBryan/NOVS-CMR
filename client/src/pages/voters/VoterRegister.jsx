import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHead, Alert } from '../../components/ui';

const EMPTY = {
  fullName: '', nationalIdNumber: '', dateOfBirth: '', gender: 'M',
  placeOfBirth: '', residentialAddress: '', occupation: 'Citizen',
  district: '', pollingStation: '',
};

export default function VoterRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [districts, setDistricts] = useState([]);
  const [stations, setStations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/reference/districts').then(setDistricts).catch(() => {});
    api.get('/stations').then(setStations).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const stationsInDistrict = form.district
    ? stations.filter((s) => String(s.district?._id || s.district) === form.district)
    : stations;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const voter = await api.post('/voters', form);
      navigate(`/app/voters/${voter._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Register a voter" subtitle="Create a voter profile, then capture their biometric." />
      <Alert type="error">{error}</Alert>

      <form className="card" onSubmit={submit} style={{ maxWidth: 720 }}>
        <div className="row">
          <div className="field">
            <label>Full name *</label>
            <input className="input" value={form.fullName} onChange={set('fullName')} required />
          </div>
          <div className="field">
            <label>National ID number *</label>
            <input className="input" value={form.nationalIdNumber} onChange={set('nationalIdNumber')} required />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Date of birth *</label>
            <input className="input" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required />
          </div>
          <div className="field">
            <label>Gender</label>
            <select className="input" value={form.gender} onChange={set('gender')}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div className="field">
            <label>Occupation</label>
            <input className="input" value={form.occupation} onChange={set('occupation')} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Place of birth</label>
            <input className="input" value={form.placeOfBirth} onChange={set('placeOfBirth')} />
          </div>
          <div className="field">
            <label>Residential address</label>
            <input className="input" value={form.residentialAddress} onChange={set('residentialAddress')} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>District *</label>
            <select className="input" value={form.district} onChange={set('district')} required>
              <option value="">Select district…</option>
              {districts.map((d) => (
                <option key={d._id} value={d._id}>{d.name} ({d.districtCode})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Polling station *</label>
            <select className="input" value={form.pollingStation} onChange={set('pollingStation')} required>
              <option value="">Select station…</option>
              {stationsInDistrict.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.stationCode})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Register voter'}</button>
          <button type="button" className="btn secondary" onClick={() => navigate('/app/voters')}>Cancel</button>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: '.82rem' }}>
          New voters start with biometric status <b>PENDING</b>. Capture their facial scan from the voter detail page to verify.
        </p>
      </form>
    </>
  );
}
