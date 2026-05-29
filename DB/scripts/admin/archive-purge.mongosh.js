/* =====================================================================
 * NOVS-CMR  -  DATA ARCHIVING & PURGING  (scalability)
 *
 * After an election is PUBLISHED and certified, its high-volume ballots
 * can be moved to cold storage (archived_votes) to keep the hot `votes`
 * collection small and fast, WITHOUT losing data (archive, never destroy).
 *
 * Strategy:
 *   1) Copy ballots of CLOSED/PUBLISHED elections older than RETAIN_DAYS
 *      into archived_votes (tagged with archive metadata).
 *   2) Remove them from the live votes collection ONLY after the copy is
 *      confirmed. Results/audit/blockchain are kept forever and untouched.
 *
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/admin/archive-purge.mongosh.js
 * ===================================================================== */

db = db.getSiblingDB('novs_cmr');
const RETAIN_DAYS = 365; // keep one year of ballots hot
const cutoff = new Date(Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000);

print('\n=== archive/purge (retain ' + RETAIN_DAYS + ' days of hot ballots) ===');

// Elections eligible for archiving.
const archivable = db.elections
  .find({ status: 'PUBLISHED', endDate: { $lt: cutoff } }, { _id: 1, electionCode: 1 })
  .toArray();

if (!archivable.length) {
  print('No PUBLISHED elections older than cutoff (' + cutoff.toISOString() + ').');
  print('Nothing to archive. (Expected on fresh sample data.)');
} else {
  archivable.forEach((e) => {
    const filter = { election: e._id };
    const n = db.votes.countDocuments(filter);
    if (!n) return;
    // 1) copy to cold storage with archive metadata
    db.votes.find(filter).forEach((doc) => {
      doc.archivedAt = new Date();
      doc.archivedFromElection = e.electionCode;
      db.archived_votes.insertOne(doc);
    });
    // 2) confirm then purge from hot collection
    const archived = db.archived_votes.countDocuments({ archivedFromElection: e.electionCode });
    if (archived >= n) {
      const del = db.votes.deleteMany(filter);
      print('  ' + e.electionCode + ': archived ' + archived + ', purged ' + del.deletedCount);
    } else {
      print('  ' + e.electionCode + ': archive incomplete, purge skipped (safety).');
    }
  });
}

print('\nHot votes count     : ' + db.votes.countDocuments());
print('Archived votes count: ' + db.archived_votes.countDocuments());
print('=== archive/purge complete ===\n');
