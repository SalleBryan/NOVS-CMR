'use strict';
const { Schema, model } = require('mongoose');

const ElectoralDistrictSchema = new Schema(
  {
    districtCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    region: { type: String, required: true },
    division: { type: String, required: true },
    type: { type: String, enum: ['URBAN', 'RURAL', 'MIXED'], default: 'MIXED' },
    registeredVoterCount: { type: Number, default: 0, min: 0 },
  },
  { collection: 'electoral_districts', timestamps: true }
);

module.exports = model('ElectoralDistrict', ElectoralDistrictSchema);
