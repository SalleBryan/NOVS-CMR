'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models, transactionService } = require('../db');

const router = express.Router();

/**
 * GET /api/results/live?electionId=...   (PUBLIC)
 * Live valid-vote tally per candidate, joined to candidate identity. Available
 * without auth so citizens can follow published results (FR 3.8).
 */
router.get(
  '/live',
  asyncHandler(async (req, res) => {
    const { electionId } = req.query;
    if (!electionId) throw new ApiError(400, 'electionId is required');
    const tallies = await models.Vote.aggregate([
      { $match: { election: toId(electionId), valid: true } },
      { $group: { _id: '$candidate', votes: { $sum: 1 } } },
      { $sort: { votes: -1 } },
    ]);
    const candidates = await models.Candidate.find({ election: electionId })
      .populate('voter', 'fullName')
      .populate('party', 'acronym')
      .lean();
    const byId = Object.fromEntries(candidates.map((c) => [String(c._id), c]));
    const total = tallies.reduce((a, t) => a + t.votes, 0);
    const rows = tallies.map((t) => {
      const c = byId[String(t._id)] || {};
      return {
        candidateId: String(t._id),
        candidateNumber: c.candidateNumber,
        name: c.voter ? c.voter.fullName : 'Unknown',
        party: c.party ? c.party.acronym : 'INDEPENDENT',
        votes: t.votes,
        percentage: total ? Math.round((t.votes / total) * 1000) / 10 : 0,
      };
    });
    res.json({ electionId, totalValidVotes: total, results: rows });
  })
);

/** GET /api/results?electionId=&level=  (stored result documents) */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.electionId) filter.election = req.query.electionId;
    if (req.query.level) filter.level = req.query.level;
    const results = await models.Result.find(filter)
      .populate('pollingStation', 'name stationCode')
      .populate('district', 'name districtCode')
      .populate('candidateTotals.candidate', 'candidateNumber')
      .sort({ level: 1 })
      .lean();
    res.json(results);
  })
);

/**
 * POST /api/results/publish  { electionId }  (ELECTORAL_ADMIN)
 * Aggregates -> upserts NATIONAL result -> sets election PUBLISHED ->
 * anchors RESULT_PUBLICATION on the ledger (transactional workflow).
 */
router.post(
  '/publish',
  authenticate,
  requireRole('ELECTORAL_ADMIN'),
  asyncHandler(async (req, res) => {
    const { electionId } = req.body || {};
    if (!electionId) throw new ApiError(400, 'electionId is required');
    const out = await transactionService.publishNationalResult({
      electionId,
      publisher: req.user.username,
    });
    res.json(out);
  })
);

function toId(id) {
  const { mongoose } = require('../db');
  return new mongoose.Types.ObjectId(id);
}

module.exports = router;
