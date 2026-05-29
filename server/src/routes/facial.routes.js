'use strict';

const crypto = require('crypto');
const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { models } = require('../db');
const rekognition = require('../services/rekognitionService');
const blockchain = require('../services/blockchainService');

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/facial/verify   (multipart/form-data: image=<file>, voterId?)
 *
 * Runs the AI-assisted facial scan (Amazon Rekognition / local fallback),
 * persists the result to facial_verifications, updates the voter's biometric
 * status, and — on PASS — anchors a VOTER_VERIFICATION event on the ledger.
 *
 * A voter token verifies itself (voterId is ignored); staff (registration
 * officer / electoral admin) verify the voter named in voterId.
 */
router.post(
  '/verify',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    let voterId;
    if (req.user.kind === 'voter') {
      voterId = req.user.sub;
    } else if (['REGISTRATION_OFFICER', 'ELECTORAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user.role)) {
      voterId = req.body.voterId;
    } else {
      throw new ApiError(403, 'Not permitted to run facial verification');
    }
    if (!voterId) throw new ApiError(400, 'voterId is required');
    if (!req.file) throw new ApiError(400, 'An image file is required (field "image")');

    const voter = await models.Voter.findById(voterId);
    if (!voter) throw new ApiError(404, 'Voter not found');

    const result = await rekognition.analyseFace(req.file.buffer);

    const verification = await models.FacialVerification.create({
      voter: voter._id,
      sessionId: 'FL-' + crypto.randomBytes(6).toString('hex'),
      livenessScore: result.livenessScore,
      similarityScore: result.similarityScore,
      status: result.status,
      referenceImageKey: `mem://${voter.voterNumber}/${Date.now()}`,
      capturedAt: new Date(),
      location: req.body.location,
    });

    let ledger = null;
    if (result.status === 'PASS') {
      voter.biometricStatus = 'VERIFIED';
      await voter.save();
      ledger = await blockchain.anchor({
        txType: 'VOTER_VERIFICATION',
        payload: {
          voter: voter.voterNumber,
          sessionId: verification.sessionId,
          provider: result.provider,
        },
        relatedEntityType: 'Voter',
        relatedEntityId: voter._id,
        endorsers: ['ELECAM_REGISTRATION'],
      });
    } else if (voter.biometricStatus !== 'VERIFIED') {
      voter.biometricStatus = 'FAILED';
      await voter.save();
    }

    await models.AuditLog.record({
      actor: req.user.kind === 'voter' ? voter.voterNumber : req.user.username,
      action: 'FACIAL_SCAN_' + result.status,
      entityType: 'Voter',
      entityId: voter._id,
      outcome: result.status === 'PASS' ? 'SUCCESS' : 'FAILURE',
      details: { provider: result.provider, reasons: result.reasons },
    });

    res.json({
      voterId: String(voter._id),
      voterNumber: voter.voterNumber,
      biometricStatus: voter.biometricStatus,
      scan: result,
      verificationId: String(verification._id),
      ledger,
    });
  })
);

/** GET /api/facial/voter/:id  — verification history for a voter (staff). */
router.get(
  '/voter/:id',
  asyncHandler(async (req, res) => {
    if (req.user.kind === 'voter' && req.user.sub !== req.params.id) {
      throw new ApiError(403, 'Voters can only view their own verifications');
    }
    const list = await models.FacialVerification.find({ voter: req.params.id })
      .sort({ capturedAt: -1 })
      .lean();
    res.json(list);
  })
);

module.exports = router;
