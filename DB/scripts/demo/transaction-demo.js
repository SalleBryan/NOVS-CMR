'use strict';

/**
 * Demonstrates the ACID transaction layer:
 *   1. A voter casts a vote (participation + ballot + audit, atomic).
 *   2. The SAME voter tries again -> rejected (one-vote-per-voter).
 *   3. An electoral admin approves the pending independent candidate
 *      (+ blockchain audit record).
 *   4. National results are published (aggregate + publish + blockchain).
 *
 *   npm run tx:demo
 */

const { connect, disconnect } = require('../../src/config/db');
const M = require('../../src/models');
const tx = require('../../src/services/transactionService');

async function main() {
  await connect();
  const tEnabled = await tx.supportsTransactions();
  console.log(
    'Multi-document transactions: ' +
      (tEnabled ? 'ENABLED (replica set)' : 'DISABLED (standalone -> sequential fallback)')
  );

  const election = await M.Election.findOne({ electionCode: 'PRES-2025' });
  // pick an eligible voter who has NOT yet voted (last verified voter)
  const voted = await M.VoterParticipation.find({ election: election._id }).distinct('voter');
  const votedSet = new Set(voted.map(String));
  const voter = await M.Voter.findOne({
    biometricStatus: 'VERIFIED',
    accountLocked: false,
    _id: { $nin: [...votedSet] },
  });
  const candidate = await M.Candidate.findOne({
    election: election._id,
    status: 'APPROVED',
  });

  console.log('\n[1] First vote for voter', voter.voterNumber);
  const r1 = await tx.submitVote({
    voterId: voter._id,
    electionId: election._id,
    candidateId: candidate._id,
    pollingStationId: voter.pollingStation,
  });
  console.log('    -> accepted, ballotToken =', r1.ballotToken);

  console.log('\n[2] Same voter votes again (must be rejected)');
  try {
    await tx.submitVote({
      voterId: voter._id,
      electionId: election._id,
      candidateId: candidate._id,
      pollingStationId: voter.pollingStation,
    });
    console.log('    -> ERROR: second vote was accepted (should not happen!)');
  } catch (e) {
    console.log('    -> correctly rejected:', e.message);
  }

  console.log('\n[3] Approve pending independent candidate C-003');
  const pending = await M.Candidate.findOne({ candidateNumber: 'C-003' });
  const appr = await tx.approveCandidate({
    candidateId: pending._id,
    approver: 'admin.electoral',
  });
  console.log('    ->', JSON.stringify(appr));

  console.log('\n[4] Publish national results');
  const pub = await tx.publishNationalResult({
    electionId: election._id,
    publisher: 'admin.electoral',
  });
  console.log('    ->', JSON.stringify(pub));

  console.log('\nLatest audit entries:');
  const logs = await M.AuditLog.find().sort({ timestamp: -1 }).limit(5).lean();
  logs.forEach((l) => console.log('   ', l.timestamp.toISOString(), l.actor, l.action, l.outcome));

  await disconnect();
}

main().catch(async (e) => {
  console.error('DEMO FAILED:', e);
  await disconnect();
  process.exit(1);
});
