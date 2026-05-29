'use strict';
const { Schema, model } = require('mongoose');

const PollingReportSchema = new Schema(
  {
    pollingStation: {
      type: Schema.Types.ObjectId,
      ref: 'PollingStation',
      required: true,
    },
    election: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    submittedBy: { type: String },
    totalVotes: { type: Number, required: true, min: 0 },
    validVotes: { type: Number, min: 0 },
    invalidVotes: { type: Number, min: 0 },
    signedBy: { type: String },
    submittedAt: { type: Date, default: Date.now },
    blockchainRef: { type: String },
  },
  { collection: 'polling_reports', timestamps: true }
);

module.exports = model('PollingReport', PollingReportSchema);
