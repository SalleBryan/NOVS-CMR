'use strict';
const { Schema, model } = require('mongoose');

const FacialVerificationSchema = new Schema(
  {
    voter: { type: Schema.Types.ObjectId, ref: 'Voter', required: true },
    sessionId: { type: String },
    livenessScore: { type: Number, required: true, min: 0, max: 100 },
    similarityScore: { type: Number, required: true, min: 0, max: 100 },
    status: { type: String, enum: ['PASS', 'FAIL'], required: true },
    referenceImageKey: { type: String },
    capturedAt: { type: Date, default: Date.now },
    location: { type: String },
  },
  { collection: 'facial_verifications', timestamps: false }
);

FacialVerificationSchema.index({ voter: 1, capturedAt: -1 });

module.exports = model('FacialVerification', FacialVerificationSchema);
