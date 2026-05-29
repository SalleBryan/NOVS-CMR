'use strict';

const bcrypt = require('bcryptjs');
const { models } = require('../db');
const { signToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/error');

/**
 * Staff login (admins, registration officers, polling officials, auditors).
 * Enforces account lockout after repeated failures (mirrors UserAccount.MAX_FAILED).
 */
async function staffLogin(username, password) {
  const user = await models.UserAccount.findOne({ username }).populate('role');
  if (!user) throw new ApiError(401, 'Invalid username or password');

  if (user.status === 'LOCKED') {
    throw new ApiError(423, 'Account locked after too many failed attempts');
  }
  if (user.status === 'DISABLED') {
    throw new ApiError(403, 'Account is disabled');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await user.registerFailedLogin();
    await safeAudit(username, 'LOGIN_FAILED', 'UserAccount', user._id, 'FAILURE');
    throw new ApiError(401, 'Invalid username or password');
  }

  await user.registerSuccessfulLogin();
  await safeAudit(username, 'LOGIN_SUCCESS', 'UserAccount', user._id, 'SUCCESS');

  const token = signToken({
    sub: String(user._id),
    kind: 'staff',
    username: user.username,
    role: user.role.roleName,
    fullName: user.fullName,
    pollingStation: user.pollingStation ? String(user.pollingStation) : null,
    branch: user.branch ? String(user.branch) : null,
  });

  return {
    token,
    user: {
      id: String(user._id),
      username: user.username,
      fullName: user.fullName,
      role: user.role.roleName,
      permissions: user.role.permissions,
      pollingStation: user.pollingStation || null,
      branch: user.branch || null,
    },
  };
}

/**
 * Voter login. Voters have no password in the register; they authenticate
 * with their voter number + national ID (the credential pair printed on the
 * voter card). The facial-scan gate is the real verification step before a
 * ballot can be cast.
 */
async function voterLogin(voterNumber, nationalIdNumber) {
  const voter = await models.Voter.findOne({
    voterNumber: String(voterNumber || '').trim(),
    nationalIdNumber: String(nationalIdNumber || '').trim(),
  });
  if (!voter) throw new ApiError(401, 'Voter number or national ID not recognised');
  if (voter.accountLocked) throw new ApiError(423, 'Voter account is locked');

  const token = signToken({
    sub: String(voter._id),
    kind: 'voter',
    voterNumber: voter.voterNumber,
    fullName: voter.fullName,
  });

  return {
    token,
    voter: publicVoter(voter),
  };
}

function publicVoter(v) {
  return {
    id: String(v._id),
    voterNumber: v.voterNumber,
    fullName: v.fullName,
    biometricStatus: v.biometricStatus,
    accountLocked: v.accountLocked,
    district: v.district,
    pollingStation: v.pollingStation,
  };
}

async function safeAudit(actor, action, entityType, entityId, outcome) {
  try {
    await models.AuditLog.record({ actor, action, entityType, entityId, outcome });
  } catch (_) {
    /* never block auth on audit failure */
  }
}

module.exports = { staffLogin, voterLogin, publicVoter };
