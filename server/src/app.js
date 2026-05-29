'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');
const blockchain = require('./services/blockchainService');
const rekognition = require('./services/rekognitionService');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientOrigins.length ? config.clientOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  // Health / capability probe (handy for the README and for the UI footer).
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'NOVS-CMR API',
      time: new Date().toISOString(),
      facialScanProvider: rekognition.providerName(),
      ledgerMode: blockchain.fabricEnabled() ? 'fabric' : 'off-chain-pointer',
    });
  });

  app.use('/api', require('./routes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
