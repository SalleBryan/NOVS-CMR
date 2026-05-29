/* =====================================================================
 * NOVS-CMR  -  PHYSICAL DATABASE SCHEMA
 * National Online Voting System (Cameroon) - CEF 438
 *
 * Maps the refined logical (collection) model to a concrete MongoDB
 * physical schema: collections + $jsonSchema validators + indexes.
 *
 * Run with:
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/schema/create-schema.mongosh.js
 *
 * Re-runnable: each collection is (re)created with collMod where it
 * already exists, so the validator can be updated without dropping data.
 * ===================================================================== */

const DB_NAME = 'novs_cmr';
db = db.getSiblingDB(DB_NAME);

print('\n=== NOVS-CMR :: creating physical schema in "' + DB_NAME + '" ===\n');

/* Helper: create a collection with a validator, or update it if it exists. */
function defineCollection(name, validator, options) {
  options = options || {};
  const exists = db.getCollectionNames().indexOf(name) !== -1;
  const spec = Object.assign(
    {
      validator: { $jsonSchema: validator },
      validationLevel: options.validationLevel || 'moderate',
      validationAction: options.validationAction || 'error',
    },
    options.extra || {}
  );
  if (exists) {
    db.runCommand(Object.assign({ collMod: name }, spec));
    print('  [updated] ' + name);
  } else {
    db.createCollection(name, spec);
    print('  [created] ' + name);
  }
}

const str = { bsonType: 'string' };
// Mongoose serialises JS numbers as BSON double, so integer-valued fields
// must accept double as well to keep the validator and the ODM in agreement.
const int = { bsonType: ['int', 'long', 'double'] };
const dbl = { bsonType: ['double', 'int', 'long'] };
const dt = { bsonType: 'date' };
const oid = { bsonType: 'objectId' };
const bool = { bsonType: 'bool' };

/* ---------------------------------------------------------------
 * 1. electoral_districts
 * ------------------------------------------------------------- */
defineCollection('electoral_districts', {
  bsonType: 'object',
  required: ['districtCode', 'name', 'region', 'division'],
  properties: {
    districtCode: { bsonType: 'string', description: 'unique district code' },
    name: str,
    region: str,
    division: str,
    type: { enum: ['URBAN', 'RURAL', 'MIXED'] },
    registeredVoterCount: int,
  },
});

/* ---------------------------------------------------------------
 * 2. elecam_branches  (administrative hierarchy)
 * ------------------------------------------------------------- */
defineCollection('elecam_branches', {
  bsonType: 'object',
  required: ['branchCode', 'name', 'level'],
  properties: {
    branchCode: str,
    name: str,
    level: { enum: ['COUNCIL', 'DIVISIONAL', 'REGIONAL', 'NATIONAL'] },
    district: oid,
    parentBranch: oid,
  },
});

/* ---------------------------------------------------------------
 * 3. political_parties
 * ------------------------------------------------------------- */
defineCollection('political_parties', {
  bsonType: 'object',
  required: ['partyCode', 'name'],
  properties: {
    partyCode: str,
    name: str,
    acronym: str,
    headName: str,
    registrationDate: dt,
    status: { enum: ['ACTIVE', 'SUSPENDED', 'DISSOLVED'] },
  },
});

/* ---------------------------------------------------------------
 * 4. polling_stations
 * ------------------------------------------------------------- */
defineCollection('polling_stations', {
  bsonType: 'object',
  required: ['stationCode', 'name', 'district'],
  properties: {
    stationCode: str,
    name: str,
    district: oid,
    location: str,
    registeredVoterCount: int,
    openingTime: dt,
    closingTime: dt,
    status: { enum: ['CLOSED', 'OPEN', 'COUNTING', 'SEALED'] },
  },
});

/* ---------------------------------------------------------------
 * 5. polling_officials
 * ------------------------------------------------------------- */
defineCollection('polling_officials', {
  bsonType: 'object',
  required: ['officialId', 'fullName', 'role', 'pollingStation'],
  properties: {
    officialId: str,
    fullName: str,
    role: { enum: ['PRESIDENT', 'SECRETARY', 'SCRUTINEER', 'POLLING_AGENT'] },
    pollingStation: oid,
    election: oid,
  },
});

/* ---------------------------------------------------------------
 * 6. voters
 * ------------------------------------------------------------- */
defineCollection('voters', {
  bsonType: 'object',
  required: [
    'voterNumber',
    'nationalIdNumber',
    'fullName',
    'dateOfBirth',
    'district',
    'pollingStation',
  ],
  properties: {
    voterNumber: str,
    nationalIdNumber: str,
    fullName: str,
    dateOfBirth: dt,
    gender: { enum: ['M', 'F'] },
    placeOfBirth: str,
    residentialAddress: str,
    occupation: str,
    district: oid,
    pollingStation: oid,
    registrationDate: dt,
    biometricStatus: { enum: ['PENDING', 'VERIFIED', 'FAILED'] },
    accountLocked: bool,
  },
});

/* ---------------------------------------------------------------
 * 7. elections
 * ------------------------------------------------------------- */
defineCollection('elections', {
  bsonType: 'object',
  required: ['electionCode', 'type', 'title', 'startDate', 'endDate'],
  properties: {
    electionCode: str,
    type: {
      enum: ['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL', 'REGIONAL', 'SENATORIAL'],
    },
    title: str,
    startDate: dt,
    endDate: dt,
    nominationDeadline: dt,
    status: {
      enum: ['DRAFT', 'NOMINATION', 'SCHEDULED', 'OPEN', 'CLOSED', 'PUBLISHED'],
    },
  },
});

/* ---------------------------------------------------------------
 * 8. candidates
 * ------------------------------------------------------------- */
defineCollection('candidates', {
  bsonType: 'object',
  required: ['candidateNumber', 'voter', 'election', 'district'],
  properties: {
    candidateNumber: str,
    voter: oid,
    election: oid,
    party: { bsonType: ['objectId', 'null'] }, // null => independent
    district: oid,
    manifestoSummary: str,
    status: { enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] },
    rejectionReason: str,
    nominationDate: dt,
    approvedBy: str,
    approvedAt: dt,
  },
});

/* ---------------------------------------------------------------
 * 9. voter_participation
 *    Tracks THAT a voter voted in an election (one row per voter/election).
 *    Deliberately separated from "votes" to preserve ballot secrecy:
 *    this collection knows WHO voted, "votes" knows WHAT was chosen,
 *    and the two are never joined.
 * ------------------------------------------------------------- */
defineCollection('voter_participation', {
  bsonType: 'object',
  required: ['voter', 'election', 'pollingStation', 'votedAt'],
  properties: {
    voter: oid,
    election: oid,
    pollingStation: oid,
    votedAt: dt,
    channel: { enum: ['ONLINE', 'STATION'] },
  },
});

/* ---------------------------------------------------------------
 * 10. votes  (anonymous ballots - NO voter reference)
 * ------------------------------------------------------------- */
defineCollection('votes', {
  bsonType: 'object',
  required: ['election', 'candidate', 'pollingStation', 'castAt', 'valid'],
  properties: {
    election: oid,
    candidate: oid,
    pollingStation: oid,
    district: oid,
    castAt: dt,
    channel: { enum: ['ONLINE', 'STATION'] },
    valid: bool,
    ballotToken: str, // random, unlinkable receipt token
  },
});

/* ---------------------------------------------------------------
 * 11. results  (aggregated; embeds per-candidate totals)
 * ------------------------------------------------------------- */
defineCollection('results', {
  bsonType: 'object',
  required: ['election', 'level', 'totalValidVotes', 'totalInvalidVotes'],
  properties: {
    election: oid,
    level: { enum: ['STATION', 'DISTRICT', 'NATIONAL'] },
    district: oid,
    pollingStation: oid,
    candidateTotals: {
      bsonType: 'array',
      items: {
        bsonType: 'object',
        required: ['candidate', 'votes'],
        properties: { candidate: oid, votes: int },
      },
    },
    totalValidVotes: int,
    totalInvalidVotes: int,
    totalRegistered: int,
    turnout: dbl,
    status: { enum: ['DRAFT', 'VERIFIED', 'PUBLISHED'] },
    publishedAt: dt,
  },
});

/* ---------------------------------------------------------------
 * 12. facial_verifications  (Amazon Rekognition metadata only)
 * ------------------------------------------------------------- */
defineCollection('facial_verifications', {
  bsonType: 'object',
  required: ['voter', 'livenessScore', 'similarityScore', 'status'],
  properties: {
    voter: oid,
    sessionId: str,
    livenessScore: dbl,
    similarityScore: dbl,
    status: { enum: ['PASS', 'FAIL'] },
    referenceImageKey: str,
    capturedAt: dt,
    location: str,
  },
});

/* ---------------------------------------------------------------
 * 13. polling_reports
 * ------------------------------------------------------------- */
defineCollection('polling_reports', {
  bsonType: 'object',
  required: ['pollingStation', 'election', 'totalVotes'],
  properties: {
    pollingStation: oid,
    election: oid,
    submittedBy: str,
    totalVotes: int,
    validVotes: int,
    invalidVotes: int,
    signedBy: str,
    submittedAt: dt,
    blockchainRef: str,
  },
});

/* ---------------------------------------------------------------
 * 14. blockchain_records  (Hyperledger Fabric audit references)
 * ------------------------------------------------------------- */
defineCollection('blockchain_records', {
  bsonType: 'object',
  required: ['txRef', 'txType', 'payloadHash', 'timestamp'],
  properties: {
    txRef: str,
    txType: {
      enum: [
        'CANDIDATE_APPROVAL',
        'VOTER_VERIFICATION',
        'RESULT_SUBMISSION',
        'RESULT_PUBLICATION',
      ],
    },
    relatedEntityType: str,
    relatedEntityId: oid,
    payloadHash: str,
    endorsers: { bsonType: 'array', items: str },
    channel: str,
    timestamp: dt,
  },
});

/* ---------------------------------------------------------------
 * 15. roles  (RBAC definitions used by the application layer)
 * ------------------------------------------------------------- */
defineCollection('roles', {
  bsonType: 'object',
  required: ['roleName'],
  properties: {
    roleName: str,
    description: str,
    permissions: { bsonType: 'array', items: str },
  },
});

/* ---------------------------------------------------------------
 * 16. user_accounts
 * ------------------------------------------------------------- */
defineCollection('user_accounts', {
  bsonType: 'object',
  required: ['username', 'passwordHash', 'role'],
  properties: {
    username: str,
    passwordHash: str,
    fullName: str,
    email: str,
    role: oid,
    branch: oid,
    pollingStation: oid,
    status: { enum: ['ACTIVE', 'LOCKED', 'DISABLED'] },
    failedLoginAttempts: int,
    lastLogin: dt,
  },
});

/* ---------------------------------------------------------------
 * 17. audit_logs
 * ------------------------------------------------------------- */
defineCollection('audit_logs', {
  bsonType: 'object',
  required: ['actor', 'action', 'timestamp'],
  properties: {
    actor: str,
    action: str,
    entityType: str,
    entityId: oid,
    timestamp: dt,
    ipAddress: str,
    outcome: { enum: ['SUCCESS', 'FAILURE'] },
    details: { bsonType: 'object' },
  },
});

/* ---------------------------------------------------------------
 * 18. archived_votes  (cold storage target for archive/purge job)
 * ------------------------------------------------------------- */
if (db.getCollectionNames().indexOf('archived_votes') === -1) {
  db.createCollection('archived_votes');
  print('  [created] archived_votes');
}

print('\n=== applying indexes ===\n');
load(
  (typeof __dirname !== 'undefined' ? __dirname + '/../admin/' : 'scripts/admin/') +
    'indexes.mongosh.js'
);

print('\n=== schema setup complete ===');
print('Collections: ' + db.getCollectionNames().sort().join(', ') + '\n');
