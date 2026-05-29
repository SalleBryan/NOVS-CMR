'use strict';

/**
 * Runs all data-consistency checks and prints a report.
 *   npm run consistency
 */

const { connect, disconnect } = require('../../src/config/db');
const consistency = require('../../src/services/consistencyService');

async function main() {
  await connect();
  const report = await consistency.runAll();
  console.log('\n=== DATA CONSISTENCY REPORT ===');
  console.log('Healthy:', report.healthy, '| Total issues:', report.totalIssues, '\n');
  for (const [name, issues] of Object.entries(report.checks)) {
    console.log(`- ${name}: ${issues.length ? 'FAIL' : 'OK'}`);
    issues.forEach((i) => console.log('    * ' + i));
  }
  await disconnect();
}

main().catch(async (e) => {
  console.error('CONSISTENCY CHECK FAILED:', e.message);
  await disconnect();
  process.exit(1);
});
