/* =====================================================================
 * NOVS-CMR  -  DATA MODIFICATION QUERIES
 * Section V asks for "five updates and five modification queries".
 * Group A = five single-document UPDATES (state transitions).
 * Group B = five multi-document / structural MODIFICATIONS (bulk & schema-shape).
 * SQL equivalents in docs/QUERY-REFERENCE.md.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/queries/03-modify-queries.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');
const election = db.elections.findOne({ electionCode: 'PRES-2025' });
const fako = db.electoral_districts.findOne({ districtCode: 'SW-FAKO' });
function r(label, res) {
  print(label + ' -> matched=' + res.matchedCount + ' modified=' + res.modifiedCount);
}

print('\n###  GROUP A - FIVE UPDATES (targeted state changes)  ###');

/* U1 - mark a voter biometric VERIFIED. */
r(
  'U1 verify voter biometric',
  db.voters.updateOne(
    { voterNumber: 'V-1010' },
    { $set: { biometricStatus: 'VERIFIED' } }
  )
);

/* U2 - approve a candidate. */
r(
  'U2 approve candidate C-002',
  db.candidates.updateOne(
    { candidateNumber: 'C-002' },
    { $set: { status: 'APPROVED', approvedBy: 'admin.electoral', approvedAt: new Date() } }
  )
);

/* U3 - open the election for voting. */
r(
  'U3 set election OPEN',
  db.elections.updateOne({ _id: election._id }, { $set: { status: 'OPEN' } })
);

/* U4 - close a polling station and seal it. */
r(
  'U4 seal polling station',
  db.polling_stations.updateOne(
    { stationCode: 'PS-FAKO-002' },
    { $set: { status: 'SEALED', closingTime: new Date() } }
  )
);

/* U5 - lock a user account after suspicious activity. */
r(
  'U5 lock user account',
  db.user_accounts.updateOne(
    { username: 'officer.buea' },
    { $set: { status: 'LOCKED' }, $inc: { failedLoginAttempts: 1 } }
  )
);

print('\n###  GROUP B - FIVE MODIFICATIONS (bulk / structural)  ###');

/* M1 - bulk reassign voters from one station to another (re-districting). */
const from = db.polling_stations.findOne({ stationCode: 'PS-FAKO-002' });
const to = db.polling_stations.findOne({ stationCode: 'PS-FAKO-001' });
r(
  'M1 bulk reassign voters PS-FAKO-002 -> PS-FAKO-001',
  db.voters.updateMany(
    { pollingStation: from._id },
    { $set: { pollingStation: to._id } }
  )
);

/* M2 - recompute & refresh registered counts per station (denormalised cache). */
let touched = 0;
db.polling_stations.find().forEach((s) => {
  const n = db.voters.countDocuments({ pollingStation: s._id });
  const res = db.polling_stations.updateOne(
    { _id: s._id },
    { $set: { registeredVoterCount: n } }
  );
  touched += res.modifiedCount;
});
print('M2 refresh station counts -> stations updated=' + touched);

/* M3 - add a new embedded candidate total into a result document. */
const someCand = db.candidates.findOne({ election: election._id, status: 'APPROVED' });
r(
  'M3 push candidate total into station result',
  db.results.updateOne(
    { election: election._id, level: 'STATION' },
    { $addToSet: { candidateTotals: { candidate: someCand._id, votes: 0 } } }
  )
);

/* M4 - schema evolution: backfill a new field on every voter. */
r(
  'M4 backfill voters.channelPreference',
  db.voters.updateMany(
    { channelPreference: { $exists: false } },
    { $set: { channelPreference: 'ONLINE' } }
  )
);

/* M5 - rename invalid votes in a district (conditional bulk correction). */
r(
  'M5 invalidate late ballots in Fako',
  db.votes.updateMany(
    { district: fako._id, castAt: { $gt: election.endDate } },
    { $set: { valid: false } }
  )
);

print('\n=== modification queries complete ===\n');
