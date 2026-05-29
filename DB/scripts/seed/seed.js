'use strict';

/**
 * NOVS-CMR - DATA POPULATION STRATEGY
 *
 * Loads a realistic sample electoral dataset through the Mongoose ODM so
 * that every validator and reference is exercised exactly as the future
 * application will exercise it. Idempotent: it wipes the operational
 * collections first, then repopulates.
 *
 *   npm run seed              (uses MONGO_URI from .env)
 *
 * Scale is deliberately small but representative (2 regions, several
 * stations, ~12 voters, 1 presidential election, 3 candidates) so results
 * are easy to verify in screenshots. Tune the COUNT constants to stress-test.
 */

const bcrypt = require('bcryptjs');
const { connect, disconnect } = require('../../src/config/db');
const M = require('../../src/models');

function daysFromNow(d) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}
function yearsAgo(y) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d;
}

async function wipe() {
  const names = Object.values(M);
  for (const Model of names) {
    await Model.deleteMany({});
  }
}

async function main() {
  await connect();
  console.log('Connected. Wiping operational collections...');
  await wipe();

  /* ---- Roles -------------------------------------------------------- */
  const roles = await M.Role.insertMany([
    {
      roleName: 'SYSTEM_ADMIN',
      description: 'Full technical administration',
      permissions: ['*'],
    },
    {
      roleName: 'ELECTORAL_ADMIN',
      description: 'Manage elections, approve candidates, publish results',
      permissions: [
        'election:*',
        'candidate:approve',
        'result:publish',
        'voter:read',
      ],
    },
    {
      roleName: 'REGISTRATION_OFFICER',
      description: 'Register and update voters',
      permissions: ['voter:create', 'voter:update', 'facial:create'],
    },
    {
      roleName: 'POLLING_OFFICIAL',
      description: 'Operate a single polling station',
      permissions: ['vote:cast', 'pollingreport:create', 'voter:read'],
    },
    {
      roleName: 'AUDIT_REVIEWER',
      description: 'Read-only access to logs and blockchain records',
      permissions: ['audit:read', 'blockchain:read'],
    },
  ]);
  const roleByName = Object.fromEntries(roles.map((r) => [r.roleName, r]));

  /* ---- Districts ---------------------------------------------------- */
  const districts = await M.ElectoralDistrict.insertMany([
    {
      districtCode: 'SW-FAKO',
      name: 'Fako',
      region: 'South-West',
      division: 'Fako',
      type: 'URBAN',
    },
    {
      districtCode: 'CE-MFOUNDI',
      name: 'Mfoundi',
      region: 'Centre',
      division: 'Mfoundi',
      type: 'URBAN',
    },
  ]);
  const [fako, mfoundi] = districts;

  /* ---- ELECAM branches --------------------------------------------- */
  const national = await M.ElecamBranch.create({
    branchCode: 'ELECAM-NAT',
    name: 'ELECAM National Headquarters',
    level: 'NATIONAL',
  });
  await M.ElecamBranch.insertMany([
    {
      branchCode: 'ELECAM-SW',
      name: 'Regional Delegation South-West',
      level: 'REGIONAL',
      district: fako._id,
      parentBranch: national._id,
    },
    {
      branchCode: 'ELECAM-CE',
      name: 'Regional Delegation Centre',
      level: 'REGIONAL',
      district: mfoundi._id,
      parentBranch: national._id,
    },
  ]);

  /* ---- Polling stations -------------------------------------------- */
  const stations = await M.PollingStation.insertMany([
    {
      stationCode: 'PS-FAKO-001',
      name: 'Buea Town Hall',
      district: fako._id,
      location: 'Buea',
      status: 'OPEN',
      openingTime: daysFromNow(0),
    },
    {
      stationCode: 'PS-FAKO-002',
      name: 'Molyko Community Centre',
      district: fako._id,
      location: 'Molyko',
      status: 'OPEN',
      openingTime: daysFromNow(0),
    },
    {
      stationCode: 'PS-MF-001',
      name: 'Yaounde Central School',
      district: mfoundi._id,
      location: 'Yaounde',
      status: 'OPEN',
      openingTime: daysFromNow(0),
    },
  ]);
  const stationByCode = Object.fromEntries(stations.map((s) => [s.stationCode, s]));

  /* ---- Polling officials ------------------------------------------- */
  await M.PollingOfficial.insertMany([
    {
      officialId: 'OFF-001',
      fullName: 'Enow Agbor',
      role: 'PRESIDENT',
      pollingStation: stationByCode['PS-FAKO-001']._id,
    },
    {
      officialId: 'OFF-002',
      fullName: 'Mballa Jean',
      role: 'PRESIDENT',
      pollingStation: stationByCode['PS-MF-001']._id,
    },
  ]);

  /* ---- Political parties ------------------------------------------- */
  const parties = await M.PoliticalParty.insertMany([
    {
      partyCode: 'PARTY-A',
      name: 'National Unity Movement',
      acronym: 'NUM',
      headName: 'A. Tabe',
      registrationDate: yearsAgo(10),
    },
    {
      partyCode: 'PARTY-B',
      name: 'Democratic Front',
      acronym: 'DF',
      headName: 'P. Kamga',
      registrationDate: yearsAgo(8),
    },
  ]);
  const [partyA, partyB] = parties;

  /* ---- Voters ------------------------------------------------------- */
  const firstNames = [
    'Bryan', 'Junior', 'Sharon', 'Lorel', 'Ronald', 'Dorenoel',
    'Tachinda', 'Luigi', 'Fontem', 'Ako', 'Marie', 'Paul',
  ];
  const voterDocs = firstNames.map((fn, i) => {
    const station = stations[i % stations.length];
    return {
      voterNumber: 'V-' + String(1000 + i),
      nationalIdNumber: 'NID-' + String(50000 + i),
      fullName: fn + ' Ndip',
      dateOfBirth: yearsAgo(22 + (i % 30)),
      gender: i % 2 === 0 ? 'M' : 'F',
      placeOfBirth: station.location,
      residentialAddress: station.location + ' quarter',
      occupation: 'Citizen',
      district: station.district,
      pollingStation: station._id,
      registrationDate: yearsAgo(1),
      biometricStatus: i < 10 ? 'VERIFIED' : 'PENDING', // last 2 not yet verified
      accountLocked: false,
    };
  });
  const voters = await M.Voter.insertMany(voterDocs);

  // Update station registered counts.
  for (const s of stations) {
    const n = voters.filter((v) => String(v.pollingStation) === String(s._id)).length;
    await M.PollingStation.updateOne(
      { _id: s._id },
      { $set: { registeredVoterCount: n } }
    );
    await M.ElectoralDistrict.updateOne(
      { _id: s.district },
      { $inc: { registeredVoterCount: n } }
    );
  }

  /* ---- Facial verifications ---------------------------------------- */
  await M.FacialVerification.insertMany(
    voters
      .filter((v) => v.biometricStatus === 'VERIFIED')
      .map((v) => ({
        voter: v._id,
        sessionId: 'FL-' + v.voterNumber,
        livenessScore: 95 + Math.random() * 4,
        similarityScore: 96 + Math.random() * 3,
        status: 'PASS',
        referenceImageKey: 's3://novs-faces/' + v.voterNumber + '.jpg',
        // recent capture so the 90-day TTL index does not expire seed data
        capturedAt: new Date(),
        location: v.placeOfBirth,
      }))
  );

  /* ---- Election ----------------------------------------------------- */
  const election = await M.Election.create({
    electionCode: 'PRES-2025',
    type: 'PRESIDENTIAL',
    title: 'Presidential Election 2025',
    startDate: daysFromNow(-1),
    endDate: daysFromNow(1),
    nominationDeadline: daysFromNow(-30),
    status: 'OPEN',
  });

  /* ---- Candidates (2 voters become candidates) --------------------- */
  const candVoters = voters.slice(0, 3);
  const candidates = await M.Candidate.insertMany([
    {
      candidateNumber: 'C-001',
      voter: candVoters[0]._id,
      election: election._id,
      party: partyA._id,
      district: candVoters[0].district,
      manifestoSummary: 'Unity and infrastructure',
      status: 'APPROVED',
      approvedBy: 'admin.electoral',
      approvedAt: yearsAgo(0),
      nominationDate: daysFromNow(-40),
    },
    {
      candidateNumber: 'C-002',
      voter: candVoters[1]._id,
      election: election._id,
      party: partyB._id,
      district: candVoters[1].district,
      manifestoSummary: 'Democratic reform',
      status: 'APPROVED',
      approvedBy: 'admin.electoral',
      approvedAt: yearsAgo(0),
      nominationDate: daysFromNow(-40),
    },
    {
      candidateNumber: 'C-003',
      voter: candVoters[2]._id,
      election: election._id,
      party: null, // independent
      district: candVoters[2].district,
      manifestoSummary: 'Independent voice',
      status: 'SUBMITTED', // pending approval - used by approveCandidate demo
      nominationDate: daysFromNow(-35),
    },
  ]);

  /* ---- User accounts ----------------------------------------------- */
  const pwd = await bcrypt.hash('ChangeMe_2026', 10);
  await M.UserAccount.insertMany([
    {
      username: 'admin.system',
      passwordHash: pwd,
      fullName: 'System Administrator',
      email: 'sysadmin@elecam.cm',
      role: roleByName['SYSTEM_ADMIN']._id,
      branch: national._id,
      status: 'ACTIVE',
    },
    {
      username: 'admin.electoral',
      passwordHash: pwd,
      fullName: 'Electoral Administrator',
      email: 'eadmin@elecam.cm',
      role: roleByName['ELECTORAL_ADMIN']._id,
      branch: national._id,
      status: 'ACTIVE',
    },
    {
      username: 'officer.buea',
      passwordHash: pwd,
      fullName: 'Registration Officer Buea',
      role: roleByName['REGISTRATION_OFFICER']._id,
      pollingStation: stationByCode['PS-FAKO-001']._id,
      status: 'ACTIVE',
    },
    {
      username: 'poll.buea001',
      passwordHash: pwd,
      fullName: 'Polling Official Buea 001',
      role: roleByName['POLLING_OFFICIAL']._id,
      pollingStation: stationByCode['PS-FAKO-001']._id,
      status: 'ACTIVE',
    },
    {
      username: 'auditor.nat',
      passwordHash: pwd,
      fullName: 'National Auditor',
      role: roleByName['AUDIT_REVIEWER']._id,
      branch: national._id,
      status: 'ACTIVE',
    },
  ]);

  /* ---- A few ballots so search/aggregate queries return data ------- */
  // Note: real votes should go through transactionService.submitVote.
  // Here we seed a handful directly (anonymous) plus their participations.
  const approvedCands = candidates.filter((c) => c.status === 'APPROVED');
  const sampleVoters = voters.slice(3, 9); // 6 voters who already voted
  const crypto = require('crypto');
  const ballots = [];
  const parts = [];
  sampleVoters.forEach((v, i) => {
    const cand = approvedCands[i % approvedCands.length];
    ballots.push({
      election: election._id,
      candidate: cand._id,
      pollingStation: v.pollingStation,
      district: v.district,
      castAt: new Date(),
      channel: 'STATION',
      valid: i !== 0, // make the first ballot invalid for realism
      ballotToken: crypto.randomBytes(12).toString('hex'),
    });
    parts.push({
      voter: v._id,
      election: election._id,
      pollingStation: v.pollingStation,
      votedAt: new Date(),
      channel: 'STATION',
    });
  });
  await M.Vote.insertMany(ballots);
  await M.VoterParticipation.insertMany(parts);

  /* ---- Blockchain + audit seed ------------------------------------- */
  await M.BlockchainRecord.insertMany([
    {
      txRef: 'TX-SEED0001',
      txType: 'CANDIDATE_APPROVAL',
      relatedEntityType: 'Candidate',
      relatedEntityId: candidates[0]._id,
      payloadHash: crypto.createHash('sha256').update('C-001:APPROVED').digest('hex'),
      endorsers: ['ELECAM_NATIONAL', 'CONSTITUTIONAL_COUNCIL'],
      timestamp: new Date(),
    },
    {
      txRef: 'TX-SEED0002',
      txType: 'RESULT_SUBMISSION',
      relatedEntityType: 'PollingStation',
      relatedEntityId: stationByCode['PS-FAKO-001']._id,
      payloadHash: crypto.createHash('sha256').update('PS-FAKO-001:RESULT').digest('hex'),
      endorsers: ['ELECAM_SW'],
      timestamp: new Date(),
    },
    {
      txRef: 'TX-SEED0003',
      txType: 'RESULT_PUBLICATION',
      relatedEntityType: 'Election',
      relatedEntityId: election._id,
      payloadHash: crypto.createHash('sha256').update('PRES-2025:PUBLISHED').digest('hex'),
      endorsers: ['ELECAM_NATIONAL', 'CONSTITUTIONAL_COUNCIL'],
      timestamp: new Date(),
    },
  ]);
  await M.AuditLog.insertMany([
    {
      actor: 'admin.electoral',
      action: 'CANDIDATE_APPROVED',
      entityType: 'Candidate',
      entityId: candidates[0]._id,
      outcome: 'SUCCESS',
    },
    {
      actor: 'admin.system',
      action: 'SCHEMA_LOADED',
      entityType: 'System',
      outcome: 'SUCCESS',
    },
  ]);

  /* ---- Station-level result for PS-FAKO-001 ------------------------ */
  const stationVotes = await M.Vote.aggregate([
    {
      $match: {
        election: election._id,
        pollingStation: stationByCode['PS-FAKO-001']._id,
        valid: true,
      },
    },
    { $group: { _id: '$candidate', votes: { $sum: 1 } } },
  ]);
  if (stationVotes.length) {
    const totalValid = stationVotes.reduce((a, s) => a + s.votes, 0);
    await M.Result.create({
      election: election._id,
      level: 'STATION',
      district: fako._id,
      pollingStation: stationByCode['PS-FAKO-001']._id,
      candidateTotals: stationVotes.map((s) => ({
        candidate: s._id,
        votes: s.votes,
      })),
      totalValidVotes: totalValid,
      totalInvalidVotes: 0,
      totalRegistered: stationByCode['PS-FAKO-001'].registeredVoterCount,
      turnout: 0,
      status: 'VERIFIED',
    });
  }

  /* ---- Summary ------------------------------------------------------ */
  const summary = {};
  for (const [name, Model] of Object.entries(M)) {
    summary[Model.collection.name] = await Model.countDocuments();
  }
  console.log('\nSeed complete. Document counts:');
  console.table(summary);

  await disconnect();
}

main().catch(async (e) => {
  console.error('SEED FAILED:', e.message);
  const w = e.writeErrors && e.writeErrors[0];
  const info = (w && w.err && w.err.errInfo) || e.errInfo;
  if (info) console.error(JSON.stringify(info.details, null, 1).slice(0, 2500));
  await disconnect();
  process.exit(1);
});
