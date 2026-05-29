'use strict';

const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { models } = require('../db');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Role-aware summary counters for dashboard cards.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [
      voters,
      verifiedVoters,
      elections,
      openElections,
      candidates,
      pendingCandidates,
      stations,
      ballots,
      blockchainRecords,
    ] = await Promise.all([
      models.Voter.countDocuments(),
      models.Voter.countDocuments({ biometricStatus: 'VERIFIED' }),
      models.Election.countDocuments(),
      models.Election.countDocuments({ status: 'OPEN' }),
      models.Candidate.countDocuments(),
      models.Candidate.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      models.PollingStation.countDocuments(),
      models.Vote.countDocuments(),
      models.BlockchainRecord.countDocuments(),
    ]);

    const stats = {
      voters,
      verifiedVoters,
      elections,
      openElections,
      candidates,
      pendingCandidates,
      stations,
      ballots,
      blockchainRecords,
    };

    // Polling officials get their station register count too.
    if (req.user.kind === 'staff' && req.user.role === 'POLLING_OFFICIAL' && req.user.pollingStation) {
      stats.stationVoters = await models.Voter.countDocuments({
        pollingStation: req.user.pollingStation,
      });
    }
    res.json(stats);
  })
);

module.exports = router;
