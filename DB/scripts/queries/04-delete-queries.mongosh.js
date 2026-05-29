/* =====================================================================
 * NOVS-CMR  -  DATA DELETION QUERIES  (Section V: two main deletions)
 *
 * Deletions in an electoral system are rare and dangerous, so both are
 * narrowly scoped and audited. SQL equivalents in docs/QUERY-REFERENCE.md.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/queries/04-delete-queries.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');
function r(label, res) {
  print(label + ' -> deleted=' + res.deletedCount);
}

/* D1 - remove a rejected candidate nomination.
 *      Only candidates explicitly REJECTED may be physically deleted; all
 *      others are retained for the legal record. */
r(
  'D1 delete rejected candidates',
  db.candidates.deleteMany({ status: 'REJECTED' })
);

/* D2 - purge stale, failed facial-verification sessions older than 90 days
 *      (defensive complement to the TTL index; reduces biometric exposure). */
const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
r(
  'D2 purge old failed facial verifications',
  db.facial_verifications.deleteMany({ status: 'FAIL', capturedAt: { $lt: cutoff } })
);

print('\nTip: never delete votes, participations, results or audit logs.');
print('=== deletion queries complete ===\n');
