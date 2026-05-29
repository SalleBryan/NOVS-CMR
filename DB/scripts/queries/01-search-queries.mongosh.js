/* =====================================================================
 * NOVS-CMR  -  SEARCH QUERIES  (Section V: five searches across tables)
 *
 * Five searches, each on a different collection, each justified, each
 * shown as an executable MongoDB query. The relational-algebra tree and
 * the tuned SQL equivalent for every query live in docs/QUERY-REFERENCE.md.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/queries/01-search-queries.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');
function banner(n, why) {
  print('\n----------------------------------------------------------');
  print('SEARCH ' + n);
  print('Why: ' + why);
  print('----------------------------------------------------------');
}

/* S1 - voters: find a voter by national ID (the authentication hot path). */
banner(
  '1  (voters)  Locate a voter by national ID',
  'Identity verification at login/registration is the single most frequent lookup; backed by the unique index on nationalIdNumber.'
);
printjson(
  db.voters
    .find(
      { nationalIdNumber: 'NID-50003' },
      { voterNumber: 1, fullName: 1, biometricStatus: 1, pollingStation: 1 }
    )
    .toArray()
);

/* S2 - candidates: approved candidates of an election, with voter+party. */
banner(
  '2  (candidates -> voters, parties)  Approved candidates for PRES-2025',
  'Building the ballot requires every APPROVED candidate joined to the person and the sponsoring party.'
);
const election = db.elections.findOne({ electionCode: 'PRES-2025' });
printjson(
  db.candidates
    .aggregate([
      { $match: { election: election._id, status: 'APPROVED' } },
      {
        $lookup: {
          from: 'voters',
          localField: 'voter',
          foreignField: '_id',
          as: 'person',
        },
      },
      {
        $lookup: {
          from: 'political_parties',
          localField: 'party',
          foreignField: '_id',
          as: 'party',
        },
      },
      { $unwind: '$person' },
      {
        $project: {
          _id: 0,
          candidateNumber: 1,
          fullName: '$person.fullName',
          party: { $ifNull: [{ $arrayElemAt: ['$party.acronym', 0] }, 'INDEPENDENT'] },
        },
      },
    ])
    .toArray()
);

/* S3 - polling_stations: stations in a district with registered counts. */
banner(
  '3  (polling_stations -> electoral_districts)  Stations in Fako',
  'Operational planning needs every station of a district together with its registered-voter load.'
);
printjson(
  db.polling_stations
    .aggregate([
      {
        $lookup: {
          from: 'electoral_districts',
          localField: 'district',
          foreignField: '_id',
          as: 'd',
        },
      },
      { $unwind: '$d' },
      { $match: { 'd.districtCode': 'SW-FAKO' } },
      {
        $project: {
          _id: 0,
          stationCode: 1,
          name: 1,
          registeredVoterCount: 1,
          district: '$d.name',
        },
      },
    ])
    .toArray()
);

/* S4 - votes: per-candidate tally for the election (the count query). */
banner(
  '4  (votes)  Live valid-vote tally per candidate',
  'Result aggregation is the core analytical query; it groups the high-volume votes collection by candidate.'
);
printjson(
  db.votes
    .aggregate([
      { $match: { election: election._id, valid: true } },
      { $group: { _id: '$candidate', votes: { $sum: 1 } } },
      { $sort: { votes: -1 } },
    ])
    .toArray()
);

/* S5 - blockchain_records: audit trail for result publication. */
banner(
  '5  (blockchain_records)  Result-publication audit references',
  'Auditors must retrieve immutable proof of every result publication, newest first.'
);
printjson(
  db.blockchain_records
    .find(
      { txType: 'RESULT_PUBLICATION' },
      { _id: 0, txRef: 1, payloadHash: 1, endorsers: 1, timestamp: 1 }
    )
    .sort({ timestamp: -1 })
    .toArray()
);

print('\n=== search queries complete ===\n');
