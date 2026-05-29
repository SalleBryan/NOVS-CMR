'use strict';
const { Schema, model } = require('mongoose');

const PollingOfficialSchema = new Schema(
  {
    officialId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ['PRESIDENT', 'SECRETARY', 'SCRUTINEER', 'POLLING_AGENT'],
      required: true,
    },
    pollingStation: {
      type: Schema.Types.ObjectId,
      ref: 'PollingStation',
      required: true,
    },
    election: { type: Schema.Types.ObjectId, ref: 'Election' },
  },
  { collection: 'polling_officials', timestamps: true }
);

module.exports = model('PollingOfficial', PollingOfficialSchema);
