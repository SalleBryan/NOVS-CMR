'use strict';

/**
 * Loads environment configuration for the NOVS-CMR backend.
 * The MongoDB connection itself is owned by the DB layer (../../DB), which
 * reads MONGO_URI from this same process environment.
 */
require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwt: {
    secret: process.env.JWT_SECRET || 'novs-cmr-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  rekognition: {
    region: process.env.AWS_REGION || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    minConfidence: Number(process.env.REKOGNITION_MIN_CONFIDENCE) || 90,
    minQuality: Number(process.env.REKOGNITION_MIN_QUALITY) || 50,
    // Real AWS is used only when region + credentials are all present.
    get enabled() {
      return Boolean(this.region && this.accessKeyId && this.secretAccessKey);
    },
  },

  fabric: {
    enabled: String(process.env.FABRIC_ENABLED).toLowerCase() === 'true',
    channel: process.env.FABRIC_CHANNEL || 'electoral-channel',
    chaincode: process.env.FABRIC_CHAINCODE || 'novs-audit',
  },
};

module.exports = config;
