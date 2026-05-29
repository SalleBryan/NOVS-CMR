'use strict';

const config = require('./config/env');
const { connect, disconnect } = require('./db');
const { createApp } = require('./app');
const rekognition = require('./services/rekognitionService');
const blockchain = require('./services/blockchainService');

async function start() {
  await connect();
  console.log('[novs-cmr] connected to MongoDB');

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[novs-cmr] API listening on http://localhost:${config.port}`);
    console.log(`[novs-cmr] facial scan : ${rekognition.providerName()}`);
    console.log(
      `[novs-cmr] ledger      : ${blockchain.fabricEnabled() ? 'Hyperledger Fabric' : 'off-chain pointer (MongoDB)'}`
    );
    console.log(`[novs-cmr] CORS origins: ${config.clientOrigins.join(', ')}`);
  });

  const shutdown = async (sig) => {
    console.log(`\n[novs-cmr] ${sig} received, shutting down...`);
    server.close(async () => {
      await disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((e) => {
  console.error('[novs-cmr] failed to start:', e.message);
  process.exit(1);
});
