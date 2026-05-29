'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models } = require('../db');

const router = express.Router();
router.use(authenticate);

const ADMIN = requireRole('ELECTORAL_ADMIN');
const VALID_STATUS = ['DRAFT', 'NOMINATION', 'SCHEDULED', 'OPEN', 'CLOSED', 'PUBLISHED'];

/** GET /api/elections  (any authenticated user — needed to render ballots) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await models.Election.find(filter).sort({ startDate: -1 }).lean());
  })
);

/** GET /api/elections/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const election = await models.Election.findById(req.params.id).lean();
    if (!election) throw new ApiError(404, 'Election not found');
    res.json(election);
  })
);

/** POST /api/elections  (create / configure) */
router.post(
  '/',
  ADMIN,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    for (const f of ['electionCode', 'type', 'title', 'startDate', 'endDate']) {
      if (!b[f]) throw new ApiError(400, `Missing required field: ${f}`);
    }
    const election = await models.Election.create({
      electionCode: b.electionCode,
      type: b.type,
      title: b.title,
      startDate: new Date(b.startDate),
      endDate: new Date(b.endDate),
      nominationDeadline: b.nominationDeadline ? new Date(b.nominationDeadline) : undefined,
      status: b.status && VALID_STATUS.includes(b.status) ? b.status : 'DRAFT',
    });
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'ELECTION_CREATED',
      entityType: 'Election',
      entityId: election._id,
      outcome: 'SUCCESS',
      details: { electionCode: election.electionCode },
    });
    res.status(201).json(election);
  })
);

/** PATCH /api/elections/:id  (edit config / change status — open/close window) */
router.patch(
  '/:id',
  ADMIN,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const update = {};
    for (const k of ['title', 'type', 'nominationDeadline', 'startDate', 'endDate']) {
      if (k in b) update[k] = /Date|Deadline/.test(k) ? new Date(b[k]) : b[k];
    }
    if (b.status) {
      if (!VALID_STATUS.includes(b.status)) throw new ApiError(400, 'Invalid status');
      update.status = b.status;
    }
    const election = await models.Election.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!election) throw new ApiError(404, 'Election not found');
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'ELECTION_UPDATED',
      entityType: 'Election',
      entityId: election._id,
      outcome: 'SUCCESS',
      details: { status: election.status },
    });
    res.json(election);
  })
);

module.exports = router;
