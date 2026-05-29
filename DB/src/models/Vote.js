'use strict';
const { Schema, model } = require('mongoose');

/**
 * Vote - an anonymous ballot. It deliberately has NO reference to the
 * voter, only to the election/candidate/station, preserving secrecy.
 */
const VoteSchema = new Schema(
  {
    election: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    pollingStation: {
      type: Schema.Types.ObjectId,
      ref: 'PollingStation',
      required: true,
    },
    district: { type: Schema.Types.ObjectId, ref: 'ElectoralDistrict' },
    castAt: { type: Date, default: Date.now },
    channel: { type: String, enum: ['ONLINE', 'STATION'], default: 'ONLINE' },
    valid: { type: Boolean, default: true },
    ballotToken: { type: String }, // random, unlinkable receipt
  },
  { collection: 'votes', timestamps: false }
);

VoteSchema.index({ election: 1, candidate: 1 });

module.exports = model('Vote', VoteSchema);
