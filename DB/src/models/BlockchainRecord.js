'use strict';
const { Schema, model } = require('mongoose');

/**
 * BlockchainRecord - an off-chain pointer to a Hyperledger Fabric audit
 * transaction. MongoDB stores only the hash + endorsement metadata; the
 * confidential payload stays in its operational collection.
 */
const BlockchainRecordSchema = new Schema(
  {
    txRef: { type: String, required: true, unique: true },
    txType: {
      type: String,
      enum: [
        'CANDIDATE_APPROVAL',
        'VOTER_VERIFICATION',
        'RESULT_SUBMISSION',
        'RESULT_PUBLICATION',
      ],
      required: true,
    },
    relatedEntityType: { type: String },
    relatedEntityId: { type: Schema.Types.ObjectId },
    payloadHash: { type: String, required: true },
    endorsers: { type: [String], default: [] },
    channel: { type: String, default: 'electoral-channel' },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'blockchain_records', timestamps: false }
);

module.exports = model('BlockchainRecord', BlockchainRecordSchema);
