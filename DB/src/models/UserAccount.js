'use strict';
const { Schema, model } = require('mongoose');

const MAX_FAILED = 5;

const UserAccountSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String },
    email: { type: String },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    branch: { type: Schema.Types.ObjectId, ref: 'ElecamBranch' },
    pollingStation: { type: Schema.Types.ObjectId, ref: 'PollingStation' },
    status: {
      type: String,
      enum: ['ACTIVE', 'LOCKED', 'DISABLED'],
      default: 'ACTIVE',
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lastLogin: { type: Date },
  },
  { collection: 'user_accounts', timestamps: true }
);

UserAccountSchema.methods.registerFailedLogin = function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= MAX_FAILED) this.status = 'LOCKED';
  return this.save();
};

UserAccountSchema.methods.registerSuccessfulLogin = function () {
  this.failedLoginAttempts = 0;
  this.lastLogin = new Date();
  return this.save();
};

module.exports = model('UserAccount', UserAccountSchema);
module.exports.MAX_FAILED = MAX_FAILED;
