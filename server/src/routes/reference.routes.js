'use strict';

/** Reference / lookup data used to populate dropdowns in the UI. */
const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { models } = require('../db');

const router = express.Router();
router.use(authenticate);

router.get(
  '/districts',
  asyncHandler(async (req, res) => {
    res.json(await models.ElectoralDistrict.find().sort({ name: 1 }).lean());
  })
);

router.get(
  '/parties',
  asyncHandler(async (req, res) => {
    res.json(await models.PoliticalParty.find().sort({ acronym: 1 }).lean());
  })
);

router.get(
  '/branches',
  asyncHandler(async (req, res) => {
    res.json(await models.ElecamBranch.find().sort({ name: 1 }).lean());
  })
);

module.exports = router;
