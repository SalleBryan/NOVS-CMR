/* =====================================================================
 * NOVS-CMR  -  PERFORMANCE MONITORING  (EXPLAIN / query plans)
 *
 * Uses explain('executionStats') to prove that the hot queries use an
 * index (IXSCAN) rather than a full collection scan (COLLSCAN), and prints
 * docs-examined vs docs-returned so bottlenecks are visible. The bottom of
 * the script shows the "before/after index" comparison on an unindexed
 * field, demonstrating the proposed improvement.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/admin/performance-explain.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');

function plan(label, explain) {
  const exec = explain.executionStats || {};
  const winning = explain.queryPlanner && explain.queryPlanner.winningPlan;
  function stage(p) {
    if (!p) return '??';
    if (p.stage === 'IXSCAN') return 'IXSCAN(' + JSON.stringify(p.keyPattern) + ')';
    if (p.inputStage) return p.stage + ' <- ' + stage(p.inputStage);
    return p.stage;
  }
  print('\n' + label);
  print('  plan        : ' + stage(winning));
  print('  nReturned   : ' + exec.nReturned);
  print('  docsExamined: ' + exec.totalDocsExamined);
  print('  keysExamined: ' + exec.totalKeysExamined);
  print('  millis      : ' + exec.executionTimeMillis);
}

const election = db.elections.findOne({ electionCode: 'PRES-2025' });

/* Q1 - voter by national id (expect IXSCAN on nationalIdNumber_1). */
plan(
  'Q1 voters.find({nationalIdNumber})',
  db.voters.find({ nationalIdNumber: 'NID-50005' }).explain('executionStats')
);

/* Q2 - votes by election+candidate (expect IXSCAN compound). */
plan(
  'Q2 votes.find({election,candidate})',
  db.votes
    .find({ election: election._id })
    .explain('executionStats')
);

/* Q3 - candidates by election+status (expect IXSCAN compound). */
plan(
  'Q3 candidates.find({election,status:APPROVED})',
  db.candidates
    .find({ election: election._id, status: 'APPROVED' })
    .explain('executionStats')
);

/* ---- Improvement demonstration: index an ad-hoc field --------------- */
function dropIfExists(idxName) {
  try {
    db.voters.dropIndex(idxName);
  } catch (e) {
    /* not present */
  }
}
print('\n=== INDEXING IMPROVEMENT DEMO (occupation) ===');
dropIfExists('occupation_1');
plan(
  'BEFORE  voters.find({occupation:"Citizen"})  (no index -> COLLSCAN)',
  db.voters.find({ occupation: "Citizen" }).explain('executionStats')
);
db.voters.createIndex({ occupation: 1 });
plan(
  'AFTER   voters.find({occupation:"Citizen"})  (index -> IXSCAN)',
  db.voters.find({ occupation: "Citizen" }).explain('executionStats')
);
// keep the schema clean - this was only a demonstration index
dropIfExists('occupation_1');

print('\n=== performance monitoring complete ===\n');
