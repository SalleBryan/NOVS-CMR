'use strict';
const { Schema, model } = require('mongoose');

const CandidateSchema = new Schema(
  {
    candidateNumber: { type: String, required: true, unique: true, trim: true },
    voter: { type: Schema.Types.ObjectId, ref: 'Voter', required: true },
    election: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    party: { type: Schema.Types.ObjectId, ref: 'PoliticalParty', default: null },
    district: {
      type: Schema.Types.ObjectId,
      ref: 'ElectoralDistrict',
      required: true,
    },
    manifestoSummary: { type: String },
    status: {
      type: String,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'SUBMITTED',
    },
    rejectionReason: { type: String },
    nominationDate: { type: Date, default: Date.now },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { collection: 'candidates', timestamps: true }
);

// A candidate can contest a given election only once.
CandidateSchema.index({ voter: 1, election: 1 }, { unique: true });

CandidateSchema.methods.isIndependent = function () {
  return !this.party;
};

module.exports = model('Candidate', CandidateSchema);
