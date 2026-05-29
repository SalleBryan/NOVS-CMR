'use strict';

const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/reference', require('./reference.routes'));
router.use('/voters', require('./voters.routes'));
router.use('/facial', require('./facial.routes'));
router.use('/elections', require('./elections.routes'));
router.use('/candidates', require('./candidates.routes'));
router.use('/votes', require('./votes.routes'));
router.use('/results', require('./results.routes'));
router.use('/stations', require('./stations.routes'));
router.use('/blockchain', require('./blockchain.routes'));
router.use('/audit', require('./audit.routes'));
router.use('/users', require('./users.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
