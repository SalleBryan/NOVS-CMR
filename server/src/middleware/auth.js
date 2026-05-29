'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { ApiError } = require('./error');

/**
 * Token shapes:
 *   staff : { sub, kind:'staff', username, role, fullName, pollingStation?, branch? }
 *   voter : { sub, kind:'voter', voterNumber, fullName }
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/** Require a valid token (any kind). Populates req.user. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication required'));
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (_) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

/** Require a staff token whose role is in the allowed list. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || req.user.kind !== 'staff') {
      return next(new ApiError(403, 'Staff access required'));
    }
    // SYSTEM_ADMIN is allowed everywhere a staff role is required.
    if (req.user.role === 'SYSTEM_ADMIN' || roles.includes(req.user.role)) {
      return next();
    }
    next(new ApiError(403, 'Insufficient role: ' + req.user.role));
  };
}

/** Require a voter token. */
function requireVoter(req, res, next) {
  if (!req.user || req.user.kind !== 'voter') {
    return next(new ApiError(403, 'Voter access required'));
  }
  next();
}

module.exports = { signToken, authenticate, requireRole, requireVoter };
