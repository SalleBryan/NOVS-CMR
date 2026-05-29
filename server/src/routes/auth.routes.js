'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { staffLogin, voterLogin } = require('../services/authService');
const { models } = require('../db');
const { publicVoter } = require('../services/authService');

const router = express.Router();

/** POST /api/auth/staff/login  { username, password } */
router.post(
  '/staff/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) throw new ApiError(400, 'username and password are required');
    res.json(await staffLogin(username, password));
  })
);

/** POST /api/auth/voter/login  { voterNumber, nationalIdNumber } */
router.post(
  '/voter/login',
  asyncHandler(async (req, res) => {
    const { voterNumber, nationalIdNumber } = req.body || {};
    if (!voterNumber || !nationalIdNumber) {
      throw new ApiError(400, 'voterNumber and nationalIdNumber are required');
    }
    res.json(await voterLogin(voterNumber, nationalIdNumber));
  })
);

/** GET /api/auth/me  -> current identity (staff or voter, fresh from DB). */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.kind === 'voter') {
      const voter = await models.Voter.findById(req.user.sub);
      if (!voter) throw new ApiError(404, 'Voter no longer exists');
      return res.json({ kind: 'voter', voter: publicVoter(voter) });
    }
    const user = await models.UserAccount.findById(req.user.sub).populate('role');
    if (!user) throw new ApiError(404, 'User no longer exists');
    res.json({
      kind: 'staff',
      user: {
        id: String(user._id),
        username: user.username,
        fullName: user.fullName,
        role: user.role.roleName,
        permissions: user.role.permissions,
        pollingStation: user.pollingStation || null,
        branch: user.branch || null,
      },
    });
  })
);

module.exports = router;
