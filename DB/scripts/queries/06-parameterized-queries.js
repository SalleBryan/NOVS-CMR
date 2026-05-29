'use strict';

/**
 * NOVS-CMR - PARAMETERIZED QUERIES  (Section V: five parameterized queries)
 *
 * The relational equivalent of a parameterized query / prepared statement
 * (PL/pgSQL, PL/SQL, T-SQL) is a function that receives bind parameters and
 * passes them to the driver as data - never string-concatenated - which is
 * what protects against injection. Each function below is exactly that:
 * a reusable, parameter-driven query the future application will call.
 * The matching PL/pgSQL function signatures are in docs/QUERY-REFERENCE.md.
 *
 *   npm run q:params
 */

const { connect, disconnect } = require('../../src/config/db');
const M = require('../../src/models');

/* P1 - find a voter by national ID (bind: $nationalId). */
async function findVoterByNationalId(nationalId) {
  return M.Voter.findOne({ nationalIdNumber: nationalId })
    .select('voterNumber fullName biometricStatus')
    .lean();
}

/* P2 - approved candidates for an election (bind: $electionCode). */
async function approvedCandidates(electionCode) {
  const election = await M.Election.findOne({ electionCode }).select('_id').lean();
  if (!election) return [];
  return M.Candidate.find({ election: election._id, status: 'APPROVED' })
    .populate('voter', 'fullName')
    .populate('party', 'acronym')
    .select('candidateNumber')
    .lean();
}

/* P3 - vote tally for an election (bind: $electionCode). */
async function tallyByCandidate(electionCode) {
  const election = await M.Election.findOne({ electionCode }).select('_id').lean();
  if (!election) return [];
  return M.Vote.aggregate([
    { $match: { election: election._id, valid: true } },
    { $group: { _id: '$candidate', votes: { $sum: 1 } } },
    { $sort: { votes: -1 } },
  ]);
}

/* P4 - voters registered in a district between two dates
 *      (binds: $districtCode, $from, $to). */
async function votersRegisteredBetween(districtCode, from, to) {
  const district = await M.ElectoralDistrict.findOne({ districtCode })
    .select('_id')
    .lean();
  if (!district) return 0;
  return M.Voter.countDocuments({
    district: district._id,
    registrationDate: { $gte: new Date(from), $lte: new Date(to) },
  });
}

/* P5 - audit-trail page for an actor (binds: $actor, $limit). */
async function auditTrail(actor, limit) {
  return M.AuditLog.find({ actor })
    .sort({ timestamp: -1 })
    .limit(Number(limit) || 10)
    .select('action entityType outcome timestamp')
    .lean();
}

async function main() {
  await connect();

  console.log('\nP1 findVoterByNationalId("NID-50002"):');
  console.log(await findVoterByNationalId('NID-50002'));

  console.log('\nP2 approvedCandidates("PRES-2025"):');
  console.log(await approvedCandidates('PRES-2025'));

  console.log('\nP3 tallyByCandidate("PRES-2025"):');
  console.log(await tallyByCandidate('PRES-2025'));

  const from = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000).toISOString();
  const to = new Date().toISOString();
  console.log(`\nP4 votersRegisteredBetween("SW-FAKO", ${from.slice(0, 10)}, today):`);
  console.log(await votersRegisteredBetween('SW-FAKO', from, to));

  console.log('\nP5 auditTrail("admin.electoral", 5):');
  console.log(await auditTrail('admin.electoral', 5));

  await disconnect();
}

module.exports = {
  findVoterByNationalId,
  approvedCandidates,
  tallyByCandidate,
  votersRegisteredBetween,
  auditTrail,
};

if (require.main === module) {
  main().catch(async (e) => {
    console.error('PARAM QUERIES FAILED:', e.message);
    await disconnect();
    process.exit(1);
  });
}
