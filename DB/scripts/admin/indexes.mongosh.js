/* =====================================================================
 * NOVS-CMR  -  INDEXING STRATEGY
 *
 * Creates every index used by the system. Indexes serve two goals:
 *   (1) INTEGRITY  - unique / compound-unique indexes enforce business
 *                    rules that $jsonSchema cannot (uniqueness, one vote
 *                    per voter per election, etc.)
 *   (2) PERFORMANCE - secondary indexes back the hot read paths
 *                     (lookups by code, by election, by district...).
 *
 * Run standalone:
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/admin/indexes.mongosh.js
 * Or it is loaded automatically by create-schema.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');

function idx(coll, keys, options) {
  options = options || {};
  db.getCollection(coll).createIndex(keys, options);
  print(
    '  [index] ' +
      coll +
      ' ' +
      JSON.stringify(keys) +
      (options.unique ? ' (UNIQUE)' : '')
  );
}

/* --- Integrity: unique business keys ------------------------------ */
idx('electoral_districts', { districtCode: 1 }, { unique: true });
idx('elecam_branches', { branchCode: 1 }, { unique: true });
idx('political_parties', { partyCode: 1 }, { unique: true });
idx('polling_stations', { stationCode: 1 }, { unique: true });
idx('polling_officials', { officialId: 1 }, { unique: true });
idx('voters', { voterNumber: 1 }, { unique: true });
idx('voters', { nationalIdNumber: 1 }, { unique: true });
idx('elections', { electionCode: 1 }, { unique: true });
idx('candidates', { candidateNumber: 1 }, { unique: true });
idx('roles', { roleName: 1 }, { unique: true });
idx('user_accounts', { username: 1 }, { unique: true });
idx('blockchain_records', { txRef: 1 }, { unique: true });

/* --- Integrity: composite business rules -------------------------- */
// One participation record per voter per election (one-vote-per-voter).
idx('voter_participation', { voter: 1, election: 1 }, { unique: true });
// A candidate may contest a given election only once.
idx('candidates', { voter: 1, election: 1 }, { unique: true });
// One aggregated result row per (election, level, station/district).
idx(
  'results',
  { election: 1, level: 1, pollingStation: 1, district: 1 },
  {
    unique: true,
    partialFilterExpression: { level: { $exists: true } },
  }
);

/* --- Performance: foreign-key style lookups ----------------------- */
idx('voters', { district: 1 });
idx('voters', { pollingStation: 1 });
idx('voters', { biometricStatus: 1 });
idx('polling_stations', { district: 1 });
idx('candidates', { election: 1, status: 1 });
idx('candidates', { party: 1 });
idx('votes', { election: 1, candidate: 1 });
idx('votes', { pollingStation: 1 });
idx('votes', { castAt: 1 });
idx('voter_participation', { election: 1 });
idx('facial_verifications', { voter: 1, capturedAt: -1 });
idx('results', { election: 1, level: 1 });
idx('polling_reports', { election: 1, pollingStation: 1 });
idx('blockchain_records', { txType: 1, timestamp: -1 });
idx('blockchain_records', { relatedEntityType: 1, relatedEntityId: 1 });
idx('audit_logs', { timestamp: -1 });
idx('audit_logs', { actor: 1, timestamp: -1 });

/* --- TTL: auto-expire transient facial-verification sessions ------ */
// Keep raw verification metadata for 90 days, then auto-purge.
idx(
  'facial_verifications',
  { capturedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, name: 'fv_ttl_90d' }
);

print('  -> indexing complete\n');
