'use strict';
const { Schema, model } = require('mongoose');

const CandidateTotalSchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    votes: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ResultSchema = new Schema(
  {
    election: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    level: {
      type: String,
      enum: ['STATION', 'DISTRICT', 'NATIONAL'],
      required: true,
    },
    district: { type: Schema.Types.ObjectId, ref: 'ElectoralDistrict' },
    pollingStation: { type: Schema.Types.ObjectId, ref: 'PollingStation' },
    candidateTotals: { type: [CandidateTotalSchema], default: [] },
    totalValidVotes: { type: Number, required: true, min: 0 },
    totalInvalidVotes: { type: Number, required: true, min: 0 },
    totalRegistered: { type: Number, min: 0 },
    turnout: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'VERIFIED', 'PUBLISHED'],
      default: 'DRAFT',
    },
    publishedAt: { type: Date },
  },
  { collection: 'results', timestamps: true }
);

// Refined constraint: per-candidate totals must reconcile with valid total.
ResultSchema.methods.isConsistent = function () {
  const sum = this.candidateTotals.reduce((a, c) => a + c.votes, 0);
  return sum === this.totalValidVotes;
};

module.exports = model('Result', ResultSchema);
