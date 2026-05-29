'use strict';

const bcrypt = require('bcryptjs');
const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models } = require('../db');

const router = express.Router();
// User management is a SYSTEM_ADMIN responsibility (requireRole lets SYSTEM_ADMIN through).
router.use(authenticate, requireRole('SYSTEM_ADMIN'));

/** GET /api/users */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await models.UserAccount.find()
      .populate('role', 'roleName')
      .populate('pollingStation', 'stationCode name')
      .select('-passwordHash')
      .sort({ username: 1 })
      .lean();
    res.json(users);
  })
);

/** GET /api/users/roles  (role catalogue) */
router.get(
  '/roles',
  asyncHandler(async (req, res) => {
    res.json(await models.Role.find().sort({ roleName: 1 }).lean());
  })
);

/** POST /api/users  { username, password, fullName, email, roleName, pollingStation? } */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    for (const f of ['username', 'password', 'roleName']) {
      if (!b[f]) throw new ApiError(400, `Missing required field: ${f}`);
    }
    const role = await models.Role.findOne({ roleName: b.roleName });
    if (!role) throw new ApiError(400, 'Unknown role: ' + b.roleName);
    const user = await models.UserAccount.create({
      username: b.username,
      passwordHash: await bcrypt.hash(b.password, 10),
      fullName: b.fullName,
      email: b.email,
      role: role._id,
      pollingStation: b.pollingStation || undefined,
      branch: b.branch || undefined,
      status: 'ACTIVE',
    });
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'USER_CREATED',
      entityType: 'UserAccount',
      entityId: user._id,
      outcome: 'SUCCESS',
      details: { username: user.username, role: b.roleName },
    });
    const obj = user.toObject();
    delete obj.passwordHash;
    res.status(201).json(obj);
  })
);

/** POST /api/users/:id/:action(lock|unlock|disable|enable) */
router.post(
  '/:id/:action(lock|unlock|disable|enable)',
  asyncHandler(async (req, res) => {
    const map = { lock: 'LOCKED', unlock: 'ACTIVE', disable: 'DISABLED', enable: 'ACTIVE' };
    const user = await models.UserAccount.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    user.status = map[req.params.action];
    if (req.params.action === 'unlock') user.failedLoginAttempts = 0;
    await user.save();
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'USER_' + req.params.action.toUpperCase(),
      entityType: 'UserAccount',
      entityId: user._id,
      outcome: 'SUCCESS',
    });
    res.json({ id: String(user._id), status: user.status });
  })
);

module.exports = router;
