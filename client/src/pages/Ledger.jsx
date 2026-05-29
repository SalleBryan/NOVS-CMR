import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageHead, Spinner, Alert, Badge, Empty } from '../components/ui';

const TYPES = ['', 'CANDIDATE_APPROVAL', 'VOTER_VERIFICATION', 'RESULT_SUBMISSION', 'RESULT_PUBLICATION'];

export default function Ledger() {
  const [records, setRecords] = useState(null);
  const [status, setStatus] = useState(null);
  const [txType, setTxType] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const params = txType ? `?txType=${txType}` : '';
      const [recs, st] = await Promise.all([
        api.get(`/blockchain${params}`),
        api.get('/blockchain/status'),
      ]);
      setRecords(recs);
      setStatus(st);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [txType]);

  return (
    <>
      <PageHead
        title="Blockchain ledger"
        subtitle="Immutable audit anchors for critical electoral events (Hyperledger Fabric trust layer)."
      />
      {status && (
        <div className="grid cols-3" style={{ marginBottom: 16 }}>
          <div className="stat"><div className="top"><span className="dot" /><span className="value">{status.totalRecords}</span></div><div className="label">Ledger records</div></div>
          <div className="stat alt"><div className="top"><span className="dot" /><span className="value" style={{ fontSize: '1.1rem' }}>{status.mode}</span></div><div className="label">Ledger mode</div></div>
          <div className="stat"><div className="top"><span className="dot" /><span className="value" style={{ fontSize: '1.1rem' }}>{status.fabricEnabled ? 'Fabric' : 'Off-chain'}</span></div><div className="label">Fabric gateway</div></div>
        </div>
      )}

      <div className="toolbar">
        <select className="input" style={{ maxWidth: 260 }} value={txType} onChange={(e) => setTxType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t || 'All event types'}</option>)}
        </select>
      </div>
      <Alert type="error">{error}</Alert>

      <div className="card" style={{ padding: 0 }}>
        {!records ? <Spinner /> : records.length === 0 ? <Empty>No ledger records.</Empty> : (
          <table className="table">
            <thead><tr><th>Tx ref</th><th>Type</th><th>Entity</th><th>Payload hash</th><th>Endorsers</th><th>When</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td className="mono">{r.txRef}</td>
                  <td><Badge>{r.txType.replace(/_/g, ' ')}</Badge></td>
                  <td className="muted">{r.relatedEntityType || '—'}</td>
                  <td className="mono" title={r.payloadHash}>{r.payloadHash?.slice(0, 14)}…</td>
                  <td className="muted" style={{ fontSize: '.8rem' }}>{(r.endorsers || []).join(', ')}</td>
                  <td className="muted" style={{ fontSize: '.8rem' }}>{new Date(r.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
