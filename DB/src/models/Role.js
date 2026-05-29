'use strict';
const { Schema, model } = require('mongoose');

const RoleSchema = new Schema(
  {
    roleName: { type: String, required: true, unique: true },
    description: { type: String },
    permissions: { type: [String], default: [] },
  },
  { collection: 'roles', timestamps: true }
);

module.exports = model('Role', RoleSchema);
