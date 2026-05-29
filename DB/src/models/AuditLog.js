'use strict';
const { Schema, model } = require('mongoose');

const AuditLogSchema = new Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    outcome: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    details: { type: Schema.Types.Mixed },
  },
  { collection: 'audit_logs', timestamps: false }
);

AuditLogSchema.index({ timestamp: -1 });

AuditLogSchema.statics.record = function (entry) {
  return this.create(Object.assign({ timestamp: new Date() }, entry));
};

module.exports = model('AuditLog', AuditLogSchema);
