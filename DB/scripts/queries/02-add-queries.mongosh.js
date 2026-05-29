/* =====================================================================
 * NOVS-CMR  -  DATA ADDITION QUERIES  (Section V: five main inserts)
 *
 * Each insert is idempotent-ish: it removes its own demo row first so the
 * script can be re-run. SQL equivalents are in docs/QUERY-REFERENCE.md.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/queries/02-add-queries.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');
const fako = db.electoral_districts.findOne({ districtCode: 'SW-FAKO' });
const station = db.polling_stations.findOne({ stationCode: 'PS-FAKO-001' });
const election = db.elections.findOne({ electionCode: 'PRES-2025' });
function show(label, r) {
  print(label + ' -> acknowledged=' + r.acknowledged + ' id=' + (r.insertedId || ''));
}

/* A1 - register a new voter (the highest-frequency write). */
db.voters.deleteOne({ voterNumber: 'V-9001' });
show(
  'A1 register voter V-9001',
  db.voters.insertOne({
    voterNumber: 'V-9001',
    nationalIdNumber: 'NID-99001',
    fullName: 'New Registrant',
    dateOfBirth: new Date('2000-01-15'),
    gender: 'F',
    placeOfBirth: 'Buea',
    residentialAddress: 'Buea',
    occupation: 'Student',
    district: fako._id,
    pollingStation: station._id,
    registrationDate: new Date(),
    biometricStatus: 'PENDING',
    accountLocked: false,
  })
);

/* A2 - record a biometric (facial) verification result. */
const v9001 = db.voters.findOne({ voterNumber: 'V-9001' });
db.facial_verifications.deleteMany({ sessionId: 'FL-V-9001' });
show(
  'A2 add facial verification',
  db.facial_verifications.insertOne({
    voter: v9001._id,
    sessionId: 'FL-V-9001',
    livenessScore: 97.4,
    similarityScore: 98.1,
    status: 'PASS',
    referenceImageKey: 's3://novs-faces/V-9001.jpg',
    capturedAt: new Date(),
    location: 'Buea',
  })
);

/* A3 - submit a new candidate nomination. */
db.candidates.deleteOne({ candidateNumber: 'C-900' });
show(
  'A3 submit candidate C-900',
  db.candidates.insertOne({
    candidateNumber: 'C-900',
    voter: v9001._id,
    election: election._id,
    party: null,
    district: fako._id,
    manifestoSummary: 'Youth empowerment',
    status: 'SUBMITTED',
    nominationDate: new Date(),
  })
);

/* A4 - create a polling-station report (end-of-day count). */
db.polling_reports.deleteMany({ pollingStation: station._id, election: election._id });
show(
  'A4 add polling report',
  db.polling_reports.insertOne({
    pollingStation: station._id,
    election: election._id,
    submittedBy: 'poll.buea001',
    totalVotes: 4,
    validVotes: 3,
    invalidVotes: 1,
    signedBy: 'Enow Agbor',
    submittedAt: new Date(),
    blockchainRef: 'TX-PR-0001',
  })
);

/* A5 - write a security audit-log entry. */
show(
  'A5 add audit log',
  db.audit_logs.insertOne({
    actor: 'officer.buea',
    action: 'VOTER_REGISTERED',
    entityType: 'Voter',
    entityId: v9001._id,
    timestamp: new Date(),
    ipAddress: '10.0.0.21',
    outcome: 'SUCCESS',
    details: { voterNumber: 'V-9001' },
  })
);

print('\n=== add queries complete ===\n');
