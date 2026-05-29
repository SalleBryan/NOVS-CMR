'use strict';
const { Schema, model } = require('mongoose');

const PollingStationSchema = new Schema(
  {
    stationCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    district: {
      type: Schema.Types.ObjectId,
      ref: 'ElectoralDistrict',
      required: true,
    },
    location: { type: String },
    registeredVoterCount: { type: Number, default: 0, min: 0 },
    openingTime: { type: Date },
    closingTime: { type: Date },
    status: {
      type: String,
      enum: ['CLOSED', 'OPEN', 'COUNTING', 'SEALED'],
      default: 'CLOSED',
    },
  },
  { collection: 'polling_stations', timestamps: true }
);

module.exports = model('PollingStation', PollingStationSchema);
