'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models } = require('../db');
const blockchain = require('../services/blockchainService');

const router = express.Router();
router.use(authenticate);

const ADMIN = requireRole('ELECTORAL_ADMIN');

/** GET /api/stations  (filters: district) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.district) filter.district = req.query.district;
    // Polling officials see their own station.
    if (req.user.kind === 'staff' && req.user.role === 'POLLING_OFFICIAL') {
      filter._id = req.user.pollingStation;
    }
    res.json(
      await models.PollingStation.find(filter)
        .populate('district', 'name districtCode')
        .sort({ stationCode: 1 })
        .lean()
    );
  })
);

/** POST /api/stations  (create) */
router.post(
  '/',
  ADMIN,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    for (const f of ['stationCode', 'name', 'district']) {
      if (!b[f]) throw new ApiError(400, `Missing required field: ${f}`);
    }
    const station = await models.PollingStation.create({
      stationCode: b.stationCode,
      name: b.name,
      district: b.district,
      location: b.location,
      status: b.status || 'CLOSED',
    });
    res.status(201).json(station);
  })
);

/** PATCH /api/stations/:id  (status open/close/seal — admin or its official) */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.user.kind !== 'staff') throw new ApiError(403, 'Staff only');
    const station = await models.PollingStation.findById(req.params.id);
    if (!station) throw new ApiError(404, 'Station not found');
    const isOwner =
      req.user.role === 'POLLING_OFFICIAL' &&
      String(req.user.pollingStation) === String(station._id);
    if (!['ELECTORAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user.role) && !isOwner) {
      throw new ApiError(403, 'Not permitted to update this station');
    }
    const b = req.body || {};
    if (b.status) station.status = b.status;
    if (b.status === 'OPEN') station.openingTime = new Date();
    if (b.status === 'SEALED' || b.status === 'CLOSED') station.closingTime = new Date();
    await station.save();
    res.json(station);
  })
);

/**
 * POST /api/stations/:id/report   (POLLING_OFFICIAL of that station)
 * End-of-day count -> polling_reports + RESULT_SUBMISSION ledger anchor.
 */
router.post(
  '/:id/report',
  requireRole('POLLING_OFFICIAL', 'ELECTORAL_ADMIN'),
  asyncHandler(async (req, res) => {
    const station = await models.PollingStation.findById(req.params.id);
    if (!station) throw new ApiError(404, 'Station not found');
    if (
      req.user.role === 'POLLING_OFFICIAL' &&
      String(req.user.pollingStation) !== String(station._id)
    ) {
      throw new ApiError(403, 'You can only report for your assigned station');
    }
    const b = req.body || {};
    if (!b.electionId) throw new ApiError(400, 'electionId is required');
    const totalVotes = Number(b.totalVotes) || 0;
    const validVotes = b.validVotes != null ? Number(b.validVotes) : totalVotes;
    const invalidVotes = b.invalidVotes != null ? Number(b.invalidVotes) : 0;

    const ledger = await blockchain.anchor({
      txType: 'RESULT_SUBMISSION',
      payload: {
        station: station.stationCode,
        totalVotes,
        validVotes,
        invalidVotes,
        by: req.user.username,
      },
      relatedEntityType: 'PollingStation',
      relatedEntityId: station._id,
      endorsers: ['ELECAM_REGIONAL'],
    });

    const report = await models.PollingReport.create({
      pollingStation: station._id,
      election: b.electionId,
      submittedBy: req.user.username,
      totalVotes,
      validVotes,
      invalidVotes,
      signedBy: b.signedBy || req.user.fullName,
      submittedAt: new Date(),
      blockchainRef: ledger.txRef,
    });
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'POLLING_REPORT_SUBMITTED',
      entityType: 'PollingStation',
      entityId: station._id,
      outcome: 'SUCCESS',
      details: { txRef: ledger.txRef },
    });
    res.status(201).json({ report, ledger });
  })
);

/** GET /api/stations/:id/reports */
router.get(
  '/:id/reports',
  asyncHandler(async (req, res) => {
    res.json(
      await models.PollingReport.find({ pollingStation: req.params.id })
        .sort({ submittedAt: -1 })
        .lean()
    );
  })
);

module.exports = router;
