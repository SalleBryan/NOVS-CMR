// Small presentational helpers reused across pages.

export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <span className="brand-mark">★</span>
      {!compact && (
        <span className="brand-name">
          NOVS-CMR
          <span className="brand-sub">National Online Voting System</span>
        </span>
      )}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <div className="loading-wrap">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 10px' }} />
        {label && <small>{label}</small>}
      </div>
    </div>
  );
}

export function Alert({ type = 'info', children }) {
  if (!children) return null;
  return <div className={`alert ${type}`}>{children}</div>;
}

export function Stat({ value, label, tone = '' }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="top">
        <span className="dot" />
        <span className="value">{value}</span>
      </div>
      <div className="label">{label}</div>
    </div>
  );
}

const STATUS_TONE = {
  APPROVED: 'green', VERIFIED: 'green', OPEN: 'green', PUBLISHED: 'green', PASS: 'green', SUCCESS: 'green', ACTIVE: 'green',
  REJECTED: 'red', FAILED: 'red', LOCKED: 'red', FAIL: 'red', DISABLED: 'red', CLOSED: 'red', FAILURE: 'red',
  PENDING: 'gold', SUBMITTED: 'gold', UNDER_REVIEW: 'gold', DRAFT: 'grey', NOMINATION: 'gold', SCHEDULED: 'gold', SEALED: 'grey', COUNTING: 'gold',
};

export function Badge({ children }) {
  const tone = STATUS_TONE[String(children).toUpperCase()] || 'grey';
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="toolbar" style={{ margin: 0 }}>{actions}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children || 'Nothing to show yet.'}</div>;
}
