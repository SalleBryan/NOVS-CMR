'use strict';

/**
 * Centralised MongoDB / Mongoose connection helper.
 * The future React + Node.js application reuses this same module so that the
 * database layer is defined in exactly one place.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/novs_cmr';

mongoose.set('strictQuery', true);

async function connect() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
  });
  return mongoose.connection;
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connect, disconnect, mongoose, MONGO_URI };
