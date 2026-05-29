'use strict';
const { Schema, model } = require('mongoose');

const ElectionSchema = new Schema(
  {
    electionCode: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      enum: ['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL', 'REGIONAL', 'SENATORIAL'],
      required: true,
    },
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    nominationDeadline: { type: Date },
    status: {
      type: String,
      enum: ['DRAFT', 'NOMINATION', 'SCHEDULED', 'OPEN', 'CLOSED', 'PUBLISHED'],
      default: 'DRAFT',
    },
  },
  { collection: 'elections', timestamps: true }
);

ElectionSchema.methods.isOpenAt = function (when) {
  const t = when || new Date();
  return this.status === 'OPEN' && t >= this.startDate && t <= this.endDate;
};

module.exports = model('Election', ElectionSchema);
