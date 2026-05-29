'use strict';

const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models } = require('../db');
const blockchain = require('../services/blockchainService');

const router = express.Router();
router.use(authenticate);

// Auditors, electoral admins and system admins may review the ledger.
const REVIEW = requireRole('AUDIT_REVIEWER', 'ELECTORAL_ADMIN');

/** GET /api/blockchain?txType=&entityType=&entityId= */
router.get(
  '/',
  REVIEW,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.txType) filter.txType = req.query.txType;
    if (req.query.entityType) filter.relatedEntityType = req.query.entityType;
    if (req.query.entityId) filter.relatedEntityId = req.query.entityId;
    res.json(
      await models.BlockchainRecord.find(filter).sort({ timestamp: -1 }).limit(200).lean()
    );
  })
);

/** GET /api/blockchain/verify?entityType=&entityId=&txType= */
router.get(
  '/verify',
  REVIEW,
  asyncHandler(async (req, res) => {
    res.json(
      await blockchain.verify({
        relatedEntityType: req.query.entityType,
        relatedEntityId: req.query.entityId,
        txType: req.query.txType,
      })
    );
  })
);

router.get(
  '/status',
  REVIEW,
  asyncHandler(async (req, res) => {
    res.json({
      fabricEnabled: blockchain.fabricEnabled(),
      mode: blockchain.fabricEnabled() ? 'fabric' : 'off-chain-pointer',
      totalRecords: await models.BlockchainRecord.countDocuments(),
      types: blockchain.VALID_TX_TYPES,
    });
  })
);

module.exports = router;
