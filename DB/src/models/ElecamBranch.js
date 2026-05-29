'use strict';
const { Schema, model } = require('mongoose');

const ElecamBranchSchema = new Schema(
  {
    branchCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    level: {
      type: String,
      enum: ['COUNCIL', 'DIVISIONAL', 'REGIONAL', 'NATIONAL'],
      required: true,
    },
    district: { type: Schema.Types.ObjectId, ref: 'ElectoralDistrict' },
    parentBranch: { type: Schema.Types.ObjectId, ref: 'ElecamBranch' },
  },
  { collection: 'elecam_branches', timestamps: true }
);

module.exports = model('ElecamBranch', ElecamBranchSchema);
