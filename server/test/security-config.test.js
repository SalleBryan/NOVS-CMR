const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../src/config/env.js'), 'utf8');
function load(env) {
  const context = { process: { env }, Buffer, module: { exports: {} },
    require: name => name === 'dotenv' ? { config() {} } : require(name) };
  vm.runInNewContext(source, context);
  return context.module.exports;
}
test('production rejects missing, weak and public development signing keys', () => {
  for (const key of [undefined, '', 'short', 'novs-cmr-dev-secret-change-me'])
    assert.throws(() => load({ NODE_ENV: 'production', JWT_SECRET: key }), /JWT_SECRET/);
});
test('development keys are unpredictable per process and explicit keys are preserved', () => {
  assert.notEqual(load({}).jwt.secret, load({}).jwt.secret);
  const key = crypto.randomBytes(32).toString('hex');
  assert.equal(load({ NODE_ENV: 'production', JWT_SECRET: key }).jwt.secret, key);
});
