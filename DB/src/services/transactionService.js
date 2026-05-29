'use strict';

/**
 * Transaction & concurrency layer (ACID).
 *
 * Sensitive electoral workflows must be all-or-nothing. Each workflow is
 * wrapped in a MongoDB multi-document transaction (via a Mongoose session)
 * when the server supports it (replica set / mongos). On a standalone
 * server transactions are unavailable, so `withTransaction` degrades to a
 * sequential best-effort execution while correctness is still guaranteed
 * by the unique indexes (one-vote-per-voter, unique candidate, etc.).
 */

const crypto = require('crypto');
const { mongoose } = require('../config/db');
const {
  Voter,
  Election,
  Candidate,
  Vote,
  VoterParticipation,
  Result,
  BlockchainRecord,
  AuditLog,
} = require('../models');

let _supportsTx = null;

async function supportsTransactions() {
  if (_supportsTx !== null) return _supportsTx;
  try {
    const admin = mongoose.connection.db.admin();
    const hello = await admin.command({ hello: 1 });
    // setName present => replica set; msg === 'isdbgrid' => mongos
    _supportsTx = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  } catch (_) {
    _supportsTx = false;
  }
  return _supportsTx;
}

/**
 * Run `work(session)` inside a transaction when possible. `session` is null
 * in the degraded (standalone) path so callers must pass it through to every
 * model operation either way.
 */
async function withTransaction(work) {
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  // Standalone fallback: no atomic boundary, indexes still protect integrity.
  return work(null);
}

function hash(obj) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(obj))
    .digest('hex');
}

/* ---------------------------------------------------------------------
 * WORKFLOW 1 - Vote submission (the most safety-critical transaction)
 *   eligibility check -> participation insert -> anonymous ballot insert
 *   -> audit. Either all succeed or all roll back.
 * ------------------------------------------------------------------- */
async function submitVote({
  voterId,
  electionId,
  candidateId,
  pollingStationId,
  channel = 'ONLINE',
}) {
  return withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const election = await Election.findById(electionId).setOptions(opts);
    if (!election) throw new Error('Election not found');
    if (election.status !== 'OPEN') throw new Error('Election is not OPEN');

    const voter = await Voter.findById(voterId).setOptions(opts);
    if (!voter) throw new Error('Voter not found');
    if (!voter.isEligible(election.startDate)) {
      await AuditLog.create(
        [
          {
            actor: voter.voterNumber,
            action: 'VOTE_REJECTED_INELIGIBLE',
            entityType: 'Election',
            entityId: election._id,
            outcome: 'FAILURE',
          },
        ],
        opts
      );
      throw new Error('Voter is not eligible (biometric/lock/age)');
    }

    const candidate = await Candidate.findOne({
      _id: candidateId,
      election: electionId,
      status: 'APPROVED',
    }).setOptions(opts);
    if (!candidate) throw new Error('Candidate not approved for this election');

    // Enforce one-vote-per-voter: unique (voter, election) index throws E11000.
    try {
      await VoterParticipation.create(
        [
          {
            voter: voter._id,
            election: election._id,
            pollingStation: pollingStationId || voter.pollingStation,
            votedAt: new Date(),
            channel,
          },
        ],
        opts
      );
    } catch (e) {
      if (e.code === 11000) throw new Error('Voter has already voted in this election');
      throw e;
    }

    // Anonymous ballot - no voter reference.
    const ballot = await Vote.create(
      [
        {
          election: election._id,
          candidate: candidate._id,
          pollingStation: pollingStationId || voter.pollingStation,
          district: voter.district,
          castAt: new Date(),
          channel,
          valid: true,
          ballotToken: crypto.randomBytes(16).toString('hex'),
        },
      ],
      opts
    );

    await AuditLog.create(
      [
        {
          actor: voter.voterNumber,
          action: 'VOTE_CAST',
          entityType: 'Election',
          entityId: election._id,
          outcome: 'SUCCESS',
          details: { channel },
        },
      ],
      opts
    );

    return { ballotToken: ballot[0].ballotToken };
  });
}

/* ---------------------------------------------------------------------
 * WORKFLOW 2 - Candidate approval (+ immutable blockchain audit ref)
 * ------------------------------------------------------------------- */
async function approveCandidate({ candidateId, approver }) {
  return withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const candidate = await Candidate.findById(candidateId).setOptions(opts);
    if (!candidate) throw new Error('Candidate not found');
    if (candidate.status === 'APPROVED') return { alreadyApproved: true };

    candidate.status = 'APPROVED';
    candidate.approvedBy = approver;
    candidate.approvedAt = new Date();
    await candidate.save(opts);

    const txRef = 'TX-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    await BlockchainRecord.create(
      [
        {
          txRef,
          txType: 'CANDIDATE_APPROVAL',
          relatedEntityType: 'Candidate',
          relatedEntityId: candidate._id,
          payloadHash: hash({
            candidate: candidate.candidateNumber,
            status: 'APPROVED',
            approver,
          }),
          endorsers: ['ELECAM_NATIONAL', 'CONSTITUTIONAL_COUNCIL'],
          timestamp: new Date(),
        },
      ],
      opts
    );

    await AuditLog.create(
      [
        {
          actor: approver,
          action: 'CANDIDATE_APPROVED',
          entityType: 'Candidate',
          entityId: candidate._id,
          outcome: 'SUCCESS',
          details: { txRef },
        },
      ],
      opts
    );

    return { candidateNumber: candidate.candidateNumber, txRef };
  });
}

/* ---------------------------------------------------------------------
 * WORKFLOW 3 - Publish national results (aggregate -> verify -> publish)
 * ------------------------------------------------------------------- */
async function publishNationalResult({ electionId, publisher }) {
  return withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const election = await Election.findById(electionId).setOptions(opts);
    if (!election) throw new Error('Election not found');

    const tallies = await Vote.aggregate([
      { $match: { election: election._id, valid: true } },
      { $group: { _id: '$candidate', votes: { $sum: 1 } } },
    ]).option(opts);

    const totalValid = tallies.reduce((a, t) => a + t.votes, 0);
    const invalid = await Vote.countDocuments(
      { election: election._id, valid: false },
      opts
    );

    const candidateTotals = tallies.map((t) => ({
      candidate: t._id,
      votes: t.votes,
    }));

    await Result.findOneAndUpdate(
      { election: election._id, level: 'NATIONAL' },
      {
        $set: {
          candidateTotals,
          totalValidVotes: totalValid,
          totalInvalidVotes: invalid,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      },
      Object.assign({ upsert: true, new: true }, opts)
    );

    election.status = 'PUBLISHED';
    await election.save(opts);

    const txRef = 'TX-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    await BlockchainRecord.create(
      [
        {
          txRef,
          txType: 'RESULT_PUBLICATION',
          relatedEntityType: 'Election',
          relatedEntityId: election._id,
          payloadHash: hash({ election: election.electionCode, candidateTotals }),
          endorsers: ['ELECAM_NATIONAL', 'CONSTITUTIONAL_COUNCIL'],
          timestamp: new Date(),
        },
      ],
      opts
    );

    await AuditLog.create(
      [
        {
          actor: publisher,
          action: 'RESULTS_PUBLISHED',
          entityType: 'Election',
          entityId: election._id,
          outcome: 'SUCCESS',
          details: { txRef, totalValid },
        },
      ],
      opts
    );

    return { election: election.electionCode, totalValid, invalid, txRef };
  });
}

module.exports = {
  supportsTransactions,
  withTransaction,
  submitVote,
  approveCandidate,
  publishNationalResult,
};
