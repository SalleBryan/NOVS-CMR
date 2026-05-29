'use strict';

const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const { models, transactionService } = require('../db');
const blockchain = require('../services/blockchainService');

const router = express.Router();
router.use(authenticate);

const ADMIN = requireRole('ELECTORAL_ADMIN');
const SUBMIT = requireRole('ELECTORAL_ADMIN', 'REGISTRATION_OFFICER');

async function nextCandidateNumber() {
  let max = 0;
  for (const c of await models.Candidate.find({}, { candidateNumber: 1 }).lean()) {
    const m = /^C-(\d+)$/.exec(c.candidateNumber || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'C-' + String(max + 1).padStart(3, '0');
}

/** GET /api/candidates?election=&status= */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.election) filter.election = req.query.election;
    if (req.query.status) filter.status = req.query.status;
    const candidates = await models.Candidate.find(filter)
      .populate('voter', 'fullName voterNumber')
      .populate('party', 'acronym name')
      .populate('district', 'name districtCode')
      .populate('election', 'electionCode title')
      .sort({ candidateNumber: 1 })
      .lean();
    res.json(candidates);
  })
);

/** GET /api/candidates/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const c = await models.Candidate.findById(req.params.id)
      .populate('voter', 'fullName voterNumber')
      .populate('party', 'acronym name')
      .populate('district', 'name districtCode')
      .populate('election', 'electionCode title')
      .lean();
    if (!c) throw new ApiError(404, 'Candidate not found');
    const ledger = await blockchain.verify({
      relatedEntityType: 'Candidate',
      relatedEntityId: c._id,
    });
    res.json({ ...c, ledger });
  })
);

/** POST /api/candidates  (submit a nomination) */
router.post(
  '/',
  SUBMIT,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    for (const f of ['voter', 'election', 'district']) {
      if (!b[f]) throw new ApiError(400, `Missing required field: ${f}`);
    }
    const candidate = await models.Candidate.create({
      candidateNumber: b.candidateNumber || (await nextCandidateNumber()),
      voter: b.voter,
      election: b.election,
      party: b.party || null,
      district: b.district,
      manifestoSummary: b.manifestoSummary,
      status: 'SUBMITTED',
      nominationDate: new Date(),
    });
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'CANDIDATE_SUBMITTED',
      entityType: 'Candidate',
      entityId: candidate._id,
      outcome: 'SUCCESS',
      details: { candidateNumber: candidate.candidateNumber },
    });
    res.status(201).json(candidate);
  })
);

/** POST /api/candidates/:id/approve  (transactional + blockchain anchor) */
router.post(
  '/:id/approve',
  ADMIN,
  asyncHandler(async (req, res) => {
    const out = await transactionService.approveCandidate({
      candidateId: req.params.id,
      approver: req.user.username,
    });
    res.json(out);
  })
);

/** POST /api/candidates/:id/reject  { reason } */
router.post(
  '/:id/reject',
  ADMIN,
  asyncHandler(async (req, res) => {
    const candidate = await models.Candidate.findById(req.params.id);
    if (!candidate) throw new ApiError(404, 'Candidate not found');
    candidate.status = 'REJECTED';
    candidate.rejectionReason = (req.body && req.body.reason) || 'Not specified';
    await candidate.save();

    const ledger = await blockchain.anchor({
      txType: 'CANDIDATE_APPROVAL', // decision record (approval/rejection)
      payload: {
        candidate: candidate.candidateNumber,
        status: 'REJECTED',
        reason: candidate.rejectionReason,
        approver: req.user.username,
      },
      relatedEntityType: 'Candidate',
      relatedEntityId: candidate._id,
    });
    await models.AuditLog.record({
      actor: req.user.username,
      action: 'CANDIDATE_REJECTED',
      entityType: 'Candidate',
      entityId: candidate._id,
      outcome: 'SUCCESS',
      details: { txRef: ledger.txRef },
    });
    res.json({ candidateNumber: candidate.candidateNumber, status: candidate.status, ledger });
  })
);

module.exports = router;
