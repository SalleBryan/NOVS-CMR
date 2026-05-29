'use strict';

/**
 * Data-consistency checks. Each function returns an array of anomaly
 * descriptions (empty array === healthy). Run via scripts/demo/consistency-demo.js
 * or scheduled as a periodic data-quality job.
 */

const {
  Voter,
  Vote,
  VoterParticipation,
  Result,
  Candidate,
} = require('../models');

/* 1. Ballots cast must never exceed recorded participations per election. */
async function ballotsVsParticipation() {
  const issues = [];
  const ballots = await Vote.aggregate([
    { $group: { _id: '$election', n: { $sum: 1 } } },
  ]);
  for (const b of ballots) {
    const parts = await VoterParticipation.countDocuments({ election: b._id });
    if (b.n > parts) {
      issues.push(
        `Election ${b._id}: ${b.n} ballots > ${parts} participations (ballot stuffing?)`
      );
    }
  }
  return issues;
}

/* 2. Each published result's per-candidate totals must equal totalValidVotes. */
async function resultTotalsReconcile() {
  const issues = [];
  const results = await Result.find({ status: { $in: ['VERIFIED', 'PUBLISHED'] } });
  for (const r of results) {
    const sum = r.candidateTotals.reduce((a, c) => a + c.votes, 0);
    if (sum !== r.totalValidVotes) {
      issues.push(
        `Result ${r._id} (${r.level}): candidate sum ${sum} != totalValidVotes ${r.totalValidVotes}`
      );
    }
  }
  return issues;
}

/* 3. Every vote must reference an APPROVED candidate. */
async function votesReferenceApprovedCandidates() {
  const issues = [];
  const approved = await Candidate.find({ status: 'APPROVED' }).distinct('_id');
  const approvedSet = new Set(approved.map(String));
  const orphan = await Vote.aggregate([
    { $group: { _id: '$candidate', n: { $sum: 1 } } },
  ]);
  for (const o of orphan) {
    if (!approvedSet.has(String(o._id))) {
      issues.push(`${o.n} vote(s) reference non-approved candidate ${o._id}`);
    }
  }
  return issues;
}

/* 4. No duplicate national identity numbers (defence in depth vs index). */
async function noDuplicateNationalIds() {
  const dups = await Voter.aggregate([
    { $group: { _id: '$nationalIdNumber', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  return dups.map((d) => `Duplicate nationalIdNumber: ${d._id} (${d.n} records)`);
}

async function runAll() {
  const checks = {
    ballotsVsParticipation: await ballotsVsParticipation(),
    resultTotalsReconcile: await resultTotalsReconcile(),
    votesReferenceApprovedCandidates: await votesReferenceApprovedCandidates(),
    noDuplicateNationalIds: await noDuplicateNationalIds(),
  };
  const total = Object.values(checks).reduce((a, v) => a + v.length, 0);
  return { healthy: total === 0, totalIssues: total, checks };
}

module.exports = {
  ballotsVsParticipation,
  resultTotalsReconcile,
  votesReferenceApprovedCandidates,
  noDuplicateNationalIds,
  runAll,
};
