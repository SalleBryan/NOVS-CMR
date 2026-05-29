'use strict';
const { Schema, model } = require('mongoose');

/**
 * Voter - a registered citizen in the national electoral register.
 * Mirrors the refined UML Voter class. Behavioural methods from the
 * refined design are implemented as instance/statics methods below.
 */
const VoterSchema = new Schema(
  {
    voterNumber: { type: String, required: true, unique: true, trim: true },
    nationalIdNumber: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['M', 'F'] },
    placeOfBirth: { type: String },
    residentialAddress: { type: String },
    occupation: { type: String },
    district: {
      type: Schema.Types.ObjectId,
      ref: 'ElectoralDistrict',
      required: true,
    },
    pollingStation: {
      type: Schema.Types.ObjectId,
      ref: 'PollingStation',
      required: true,
    },
    registrationDate: { type: Date, default: Date.now },
    biometricStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'FAILED'],
      default: 'PENDING',
    },
    accountLocked: { type: Boolean, default: false },
  },
  { collection: 'voters', timestamps: true }
);

const LEGAL_VOTING_AGE = 20; // Cameroon Electoral Code

VoterSchema.methods.ageOn = function (referenceDate) {
  const ref = referenceDate || new Date();
  let age = ref.getFullYear() - this.dateOfBirth.getFullYear();
  const m = ref.getMonth() - this.dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < this.dateOfBirth.getDate())) age--;
  return age;
};

VoterSchema.methods.isEligible = function (referenceDate) {
  return (
    !this.accountLocked &&
    this.biometricStatus === 'VERIFIED' &&
    this.ageOn(referenceDate) >= LEGAL_VOTING_AGE
  );
};

VoterSchema.methods.lock = function () {
  this.accountLocked = true;
  return this.save();
};

VoterSchema.methods.unlock = function () {
  this.accountLocked = false;
  return this.save();
};

module.exports = model('Voter', VoterSchema);
module.exports.LEGAL_VOTING_AGE = LEGAL_VOTING_AGE;
