'use strict';

const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models } = require('../db');

const router = express.Router();
router.use(authenticate, requireRole('AUDIT_REVIEWER', 'ELECTORAL_ADMIN'));

/** GET /api/audit?actor=&action=&limit= */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.action) filter.action = new RegExp(req.query.action, 'i');
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await models.AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).lean());
  })
);

module.exports = router;
