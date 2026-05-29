'use strict';
const { Schema, model } = require('mongoose');

const PoliticalPartySchema = new Schema(
  {
    partyCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    acronym: { type: String },
    headName: { type: String },
    registrationDate: { type: Date },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'DISSOLVED'],
      default: 'ACTIVE',
    },
  },
  { collection: 'political_parties', timestamps: true }
);

module.exports = model('PoliticalParty', PoliticalPartySchema);
