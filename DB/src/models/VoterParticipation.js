'use strict';
const { Schema, model } = require('mongoose');

/**
 * VoterParticipation records THAT a voter voted in an election.
 * It is intentionally kept separate from the Vote (ballot) document so
 * that voter identity is never linked to ballot choice (ballot secrecy).
 * The unique (voter, election) index enforces "one vote per voter".
 */
const VoterParticipationSchema = new Schema(
  {
    voter: { type: Schema.Types.ObjectId, ref: 'Voter', required: true },
    election: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    pollingStation: {
      type: Schema.Types.ObjectId,
      ref: 'PollingStation',
      required: true,
    },
    votedAt: { type: Date, default: Date.now },
    channel: { type: String, enum: ['ONLINE', 'STATION'], default: 'ONLINE' },
  },
  { collection: 'voter_participation', timestamps: false }
);

VoterParticipationSchema.index({ voter: 1, election: 1 }, { unique: true });

module.exports = model('VoterParticipation', VoterParticipationSchema);
