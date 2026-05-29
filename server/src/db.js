'use strict';

/**
 * Single bridge to the existing database layer (../../DB).
 *
 * We deliberately reuse the DB layer's Mongoose instance, models and
 * connection helper so the application and the database are defined in
 * exactly one place (as promised in DB/README.md). Requiring the model
 * files from DB resolves `mongoose` from DB/node_modules, so there is a
 * single shared Mongoose instance across the whole process.
 */

const { connect, disconnect, mongoose, MONGO_URI } = require('../../DB/src/config/db');
const models = require('../../DB/src/models');
const transactionService = require('../../DB/src/services/transactionService');
const consistencyService = require('../../DB/src/services/consistencyService');

module.exports = {
  connect,
  disconnect,
  mongoose,
  MONGO_URI,
  models,
  transactionService,
  consistencyService,
};
