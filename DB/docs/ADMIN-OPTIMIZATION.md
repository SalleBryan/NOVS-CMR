# NOVS-CMR — Administration & Optimization

Covers **Section V** of the assignment: indexing, performance monitoring, security/RBAC,
transactions & consistency, backup/recovery, archiving/purging, and scalability.

---

## 1. Indexing strategy

Defined in [`scripts/admin/indexes.mongosh.js`](../scripts/admin/indexes.mongosh.js)
(also loaded automatically by the schema script). Indexes serve two distinct goals.

### 1.1 Integrity (constraints `$jsonSchema` cannot express)

| Index | Rule enforced |
|-------|---------------|
| `voters.nationalIdNumber {unique}`, `voters.voterNumber {unique}` | one record per citizen |
| `voter_participation.{voter,election} {unique}` | **one vote per voter per election** |
| `candidates.{voter,election} {unique}` | a person may contest an election only once |
| `results.{election,level,pollingStation,district} {unique, partial}` | one tally row per scope |
| `…Code {unique}` on every reference collection | stable business keys |

These are the document-DB equivalent of `UNIQUE` / `PRIMARY KEY` constraints and are the
backbone of correctness on a **standalone** server where multi-document transactions are
unavailable (see §4).

### 1.2 Performance (hot read paths)

Compound and single-field secondary indexes back every frequent query:
`votes.{election,candidate}` (tally), `candidates.{election,status}` (ballot build),
`voters.district` / `voters.pollingStation` (operational reports),
`blockchain_records.{txType,timestamp:-1}` and `audit_logs.{actor,timestamp:-1}`
(audit pages — the sort is served by the index, no in-memory sort).

### 1.3 TTL retention

`facial_verifications.capturedAt {expireAfterSeconds: 90 days}` (`fv_ttl_90d`)
auto-purges transient biometric metadata, minimising the window of sensitive-data exposure.

---

## 2. Performance monitoring (`explain`)

[`scripts/admin/performance-explain.mongosh.js`](../scripts/admin/performance-explain.mongosh.js)
runs `explain('executionStats')` on the hot queries and prints `stage / nReturned /
totalDocsExamined / totalKeysExamined / millis`. The healthy signal is **IXSCAN** with
`docsExamined ≈ nReturned`.

The script ends with a **before/after** demonstration on an *unindexed* field
(`voters.occupation = 'Citizen'`):

| | Plan | docsExamined |
|---|------|-------------|
| Before | `COLLSCAN` | every voter document |
| After `createIndex({occupation:1})` | `IXSCAN` | only the matching rows |

The demo index is dropped at the end to keep the schema clean — it exists only to prove the
improvement quantitatively.

Run: `npm run perf`.

---

## 3. Security & access control (RBAC)

Two layers, deliberately separate:

1. **Application-level roles** — the `roles` + `user_accounts` collections (seeded), used by
   the future app for feature-level authorization (e.g. `VOTER`, `REG_OFFICER`,
   `ELECTORAL_ADMIN`, `AUDITOR`, `SYS_ADMIN`). `user_accounts` also tracks
   `failedLoginAttempts` and locks after `MAX_FAILED = 5` (see
   [`src/models/UserAccount.js`](../src/models/UserAccount.js)).

2. **Database-level RBAC** — [`scripts/security/setup-roles.mongosh.js`](../scripts/security/setup-roles.mongosh.js)
   creates MongoDB custom roles and users with least-privilege grants:

   | DB role | Grants | DB user |
   |---------|--------|---------|
   | `novsAppRole` | CRUD on operational collections | `novs_app` |
   | `registrationOfficerRole` | write voters / facial_verifications | `officer_reg` |
   | `electoralAdminRole` | manage elections / candidates / results | `admin_electoral` |
   | `auditReviewerRole` | **read-only** across audit + blockchain | `auditor` |

   > ⚠️ The script uses placeholder passwords `ChangeMe_*_2026`. **Change them before any
   > real deployment** and enable `security.authorization: enabled` in `mongod.cfg`
   > (instructions are printed by the script).

Run: `npm run security`.

---

## 4. Transactions & consistency

[`src/services/transactionService.js`](../src/services/transactionService.js) wraps the
critical multi-step operations:

- `submitVote()` — checks eligibility → inserts a `voter_participation` row (the unique index
  makes a second attempt fail with `E11000` = "already voted") → inserts an **anonymous**
  ballot into `votes` → writes an audit log. **Identity and ballot are never in the same
  document**, which is how ballot secrecy and the one-vote rule coexist.
- `approveCandidate()` — flips status + writes a `CANDIDATE_APPROVAL` blockchain record.
- `publishNationalResult()` — aggregates tallies → upserts the `results` row → sets the
  election `PUBLISHED` → writes a `RESULT_PUBLICATION` blockchain record.

**Standalone fallback.** The dev server is a standalone `mongod` (not a replica set), so true
multi-document transactions are unavailable. `withTransaction()` detects this
(`supportsTransactions()` inspects `hello.setName` / `isdbgrid`) and **falls back to
sequential execution**, relying on the unique indexes for integrity. On a replica set or
`mongos` it automatically upgrades to a real ACID transaction with no code change.

[`src/services/consistencyService.js`](../src/services/consistencyService.js) provides
post-hoc invariants — `ballotsVsParticipation`, `resultTotalsReconcile`,
`votesReferenceApprovedCandidates`, `noDuplicateNationalIds` — runnable via
`npm run consistency`. Demonstrate transactions with `npm run tx:demo`.

---

## 5. Backup & recovery

[`scripts/backup/backup.ps1`](../scripts/backup/backup.ps1) (PowerShell 7+, Windows):

- **full** — `mongodump` BSON dump (preferred; requires *MongoDB Database Tools*).
- **logical** — fallback that works **without** the Database Tools: clones every collection
  into a `novs_cmr_backup` database via mongosh **and** exports timestamped JSON to
  `C:\NOVS-Backups\`.
- **auto** (default) — picks `full` if `mongodump` is on PATH, else `logical`.

[`scripts/backup/restore.ps1`](../scripts/backup/restore.ps1) mirrors it with `full` /
`logical` / `clone` modes.

The `novs_cmr_backup` clone is what recovery query **R2** restores a deleted document from
(see [QUERY-REFERENCE.md](QUERY-REFERENCE.md) Part 5). Recovery query **R1** needs no backup
at all — it rebuilds a lost result by replaying the immutable `votes`.

```powershell
pwsh scripts/backup/backup.ps1                 # auto
pwsh scripts/backup/restore.ps1 -Mode clone    # restore everything from the clone
```

---

## 6. Archiving & purging (scalability)

[`scripts/admin/archive-purge.mongosh.js`](../scripts/admin/archive-purge.mongosh.js) keeps
the hot `votes` collection small: ballots belonging to `PUBLISHED` elections older than
`RETAIN_DAYS = 365` are **copied** to `archived_votes` (cold storage, tagged with archive
metadata) and only then removed from `votes` — **archive first, confirm, then purge**.
Results, audit logs and blockchain records are kept forever. Run: `npm run archive`.

---

## 7. Scalability outlook

- **Vertical/read scaling:** a **replica set** gives HA + secondary reads, and unlocks real
  multi-document transactions (§4).
- **Horizontal scaling:** `votes` is the natural **sharding** candidate — shard key
  `{election, pollingStation}` co-locates a station's ballots and distributes the national
  write load across shards during polling hours.
- **Hot/cold split:** archiving (§6) plus the TTL index (§1.3) bound the working-set size so
  read latency stays flat as historical elections accumulate.
