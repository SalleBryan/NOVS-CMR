'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models } = require('../db');

const router = express.Router();
router.use(authenticate);

const STAFF_VIEW = requireRole('REGISTRATION_OFFICER', 'ELECTORAL_ADMIN', 'POLLING_OFFICIAL');
const STAFF_EDIT = requireRole('REGISTRATION_OFFICER', 'ELECTORAL_ADMIN');

/** Next voter number, e.g. V-1042 (highest numeric suffix + 1). */
async function nextVoterNumber() {
  let max = 1000;
  for (const v of await models.Voter.find({}, { voterNumber: 1 }).lean()) {
    const m = /^V-(\d+)$/.exec(v.voterNumber || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'V-' + (max + 1);
}

/** GET /api/voters  (filters: q, district, pollingStation, biometricStatus) */
router.get(
  '/',
  STAFF_VIEW,
  asyncHandler(async (req, res) => {
    const { q, district, pollingStation, biometricStatus } = req.query;
    const filter = {};
    if (district) filter.district = district;
    if (biometricStatus) filter.biometricStatus = biometricStatus;
    // Polling officials only see their own station's register.
    if (req.user.role === 'POLLING_OFFICIAL') {
      filter.pollingStation = req.user.pollingStation;
    } else if (pollingStation) {
      filter.pollingStation = pollingStation;
    }
    if (q) {
      filter.$or = [
        { fullName: new RegExp(q, 'i') },
        { voterNumber: new RegExp(q, 'i') },
        { nationalIdNumber: new RegExp(q, 'i') },
      ];
    }
    const voters = await models.Voter.find(filter)
      .populate('district', 'name districtCode')
      .populate('pollingStation', 'name stationCode')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(voters);
  })
);

/** GET /api/voters/:id */
router.get(
  '/:id',
  STAFF_VIEW,
  asyncHandler(async (req, res) => {
    const voter = await models.Voter.findById(req.params.id)
      .populate('district', 'name districtCode')
      .populate('pollingStation', 'name stationCode')
      .lean();
    if (!voter) throw new ApiError(404, 'Voter not found');
    if (
      req.user.role === 'POLLING_OFFICIAL' &&
      String(voter.pollingStation?._id) !== String(req.user.pollingStation)
    ) {
      throw new ApiError(403, 'Voter is outside your polling station');
    }
    const verifications = await models.FacialVerification.find({ voter: voter._id })
      .sort({ capturedAt: -1 })
      .limit(5)
      .lean();
    res.json({ ...voter, facialVerifications: verifications });
  })
);

/** POST /api/voters  (register a new voter; biometricStatus starts PENDING) */
router.post(
  '/',
  STAFF_EDIT,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const required = ['fullName', 'nationalIdNumber', 'dateOfBirth', 'district', 'pollingStation'];
    for (const f of required) {
      if (!b[f]) throw new ApiError(400, `Missing required field: ${f}`);
    }
    const voter = await models.Voter.create({
      voterNumber: b.voterNumber || (await nextVoterNumber()),
      nationalIdNumber: b.nationalIdNumber,
      fullName: b.fullName,
      dateOfBirth: new Date(b.dateOfBirth),
      gender: b.gender,
      placeOfBirth: b.placeOfBirth,
      residentialAddress: b.residentialAddress,
      occupation: b.occupation || 'Citizen',
      district: b.district,
      pollingStation: b.pollingStation,
      biometricStatus: 'PENDING',
      accountLocked: false,
    });
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'VOTER_REGISTERED',
      entityType: 'Voter',
      entityId: voter._id,
      outcome: 'SUCCESS',
      details: { voterNumber: voter.voterNumber },
    });
    res.status(201).json(voter);
  })
);

/** PATCH /api/voters/:id  (update details before finalisation) */
router.patch(
  '/:id',
  STAFF_EDIT,
  asyncHandler(async (req, res) => {
    const allowed = [
      'fullName', 'gender', 'placeOfBirth', 'residentialAddress',
      'occupation', 'district', 'pollingStation', 'dateOfBirth',
    ];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    if (update.dateOfBirth) update.dateOfBirth = new Date(update.dateOfBirth);
    const voter = await models.Voter.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!voter) throw new ApiError(404, 'Voter not found');
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'VOTER_UPDATED',
      entityType: 'Voter',
      entityId: voter._id,
      outcome: 'SUCCESS',
    });
    res.json(voter);
  })
);

/** POST /api/voters/:id/lock  &  /unlock  (ELECTORAL_ADMIN / SYSTEM_ADMIN) */
router.post(
  '/:id/:action(lock|unlock)',
  requireRole('ELECTORAL_ADMIN'),
  asyncHandler(async (req, res) => {
    const voter = await models.Voter.findById(req.params.id);
    if (!voter) throw new ApiError(404, 'Voter not found');
    await (req.params.action === 'lock' ? voter.lock() : voter.unlock());
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'VOTER_' + req.params.action.toUpperCase(),
      entityType: 'Voter',
      entityId: voter._id,
      outcome: 'SUCCESS',
    });
    res.json({ id: String(voter._id), accountLocked: voter.accountLocked });
  })
);

module.exports = router;
