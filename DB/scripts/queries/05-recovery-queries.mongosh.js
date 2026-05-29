/* =====================================================================
 * NOVS-CMR  -  DATA RECOVERY QUERIES  (Section V: two recovery queries)
 *
 * Two ways to recover data after a failure WITHOUT a full mongorestore:
 *   R1 - reconstruct an aggregate (result) that was lost/corrupted, by
 *        recomputing it from the surviving immutable source (votes).
 *   R2 - recover an accidentally-deleted voter from the most recent backup
 *        database (novs_cmr_backup) created by scripts/backup/backup.ps1
 *        (--logical mode) or a mongorestore into a staging DB.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/queries/05-recovery-queries.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');
const election = db.elections.findOne({ electionCode: 'PRES-2025' });

/* ---------------------------------------------------------------------
 * R1 - Recompute a lost NATIONAL result from the source-of-truth votes.
 *      Votes are append-only and immutable, so an aggregate can always be
 *      rebuilt. This is the "recover by replay" pattern.
 * ------------------------------------------------------------------- */
print('\nR1  Rebuild NATIONAL result from votes (replay recovery)');
const tallies = db.votes
  .aggregate([
    { $match: { election: election._id, valid: true } },
    { $group: { _id: '$candidate', votes: { $sum: 1 } } },
  ])
  .toArray();
const totalValid = tallies.reduce((a, t) => a + t.votes, 0);
const invalid = db.votes.countDocuments({ election: election._id, valid: false });
const rebuilt = db.results.updateOne(
  { election: election._id, level: 'NATIONAL' },
  {
    $set: {
      candidateTotals: tallies.map((t) => ({ candidate: t._id, votes: t.votes })),
      totalValidVotes: totalValid,
      totalInvalidVotes: invalid,
      status: 'VERIFIED',
      publishedAt: new Date(),
    },
  },
  { upsert: true }
);
print(
  '   -> rebuilt (matched=' +
    rebuilt.matchedCount +
    ', upserted=' +
    (rebuilt.upsertedCount || 0) +
    '), totalValid=' +
    totalValid
);

/* ---------------------------------------------------------------------
 * R2 - Restore a deleted voter document from a backup database.
 *      Assumes a logical backup DB named "novs_cmr_backup" exists (created
 *      by backup.ps1). Copies the missing voter back into the live DB.
 * ------------------------------------------------------------------- */
print('\nR2  Restore a deleted voter from backup database novs_cmr_backup');
const backup = db.getSiblingDB('novs_cmr_backup');
const VOTER_TO_RECOVER = 'V-1000';
if (db.getSiblingDB('admin').runCommand({ listDatabases: 1, nameOnly: true })
      .databases.some((d) => d.name === 'novs_cmr_backup')) {
  const fromBackup = backup.voters.findOne({ voterNumber: VOTER_TO_RECOVER });
  const liveExists = db.voters.findOne({ voterNumber: VOTER_TO_RECOVER });
  if (fromBackup && !liveExists) {
    db.voters.insertOne(fromBackup);
    print('   -> voter ' + VOTER_TO_RECOVER + ' restored from backup.');
  } else if (liveExists) {
    print('   -> voter ' + VOTER_TO_RECOVER + ' already present; nothing to recover.');
  } else {
    print('   -> voter ' + VOTER_TO_RECOVER + ' not found in backup.');
  }
} else {
  print('   -> backup DB novs_cmr_backup not found.');
  print('      Create it first:  npm run backup   (see scripts/backup/backup.ps1)');
}

print('\n=== recovery queries complete ===\n');
