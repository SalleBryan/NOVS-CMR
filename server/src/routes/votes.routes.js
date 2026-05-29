'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireVoter } = require('../middleware/auth');
const { models, transactionService } = require('../db');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/votes/status?electionId=...   (voter)
 * Tells the UI whether this voter has already participated in the election,
 * without ever linking the voter to a ballot (ballot secrecy, NFR 4.2).
 */
router.get(
  '/status',
  requireVoter,
  asyncHandler(async (req, res) => {
    const { electionId } = req.query;
    if (!electionId) throw new ApiError(400, 'electionId is required');
    const voter = await models.Voter.findById(req.user.sub);
    if (!voter) throw new ApiError(404, 'Voter not found');
    const participation = await models.VoterParticipation.findOne({
      voter: voter._id,
      election: electionId,
    }).lean();
    const election = await models.Election.findById(electionId).lean();
    res.json({
      hasVoted: Boolean(participation),
      eligible: voter.isEligible(election ? election.startDate : new Date()),
      biometricStatus: voter.biometricStatus,
      accountLocked: voter.accountLocked,
      electionStatus: election ? election.status : null,
    });
  })
);

/**
 * POST /api/votes/cast   (voter)  { electionId, candidateId }
 * Delegates to the safety-critical transactional submitVote workflow:
 * eligibility -> one-vote participation insert -> anonymous ballot -> audit.
 */
router.post(
  '/cast',
  requireVoter,
  asyncHandler(async (req, res) => {
    const { electionId, candidateId } = req.body || {};
    if (!electionId || !candidateId) {
      throw new ApiError(400, 'electionId and candidateId are required');
    }
    try {
      const out = await transactionService.submitVote({
        voterId: req.user.sub,
        electionId,
        candidateId,
        channel: 'ONLINE',
      });
      res.status(201).json({ success: true, ballotToken: out.ballotToken });
    } catch (e) {
      // Map known business errors to clean status codes.
      const msg = e.message || 'Vote failed';
      const code = /already voted/i.test(msg)
        ? 409
        : /eligible|OPEN|not approved|not found/i.test(msg)
        ? 422
        : 400;
      throw new ApiError(code, msg);
    }
  })
);

module.exports = router;
