# NOVS-CMR — National Online Voting System (Cameroon)
### MongoDB database layer

**Course:** CEF 438 — Advanced Databases & Administration
**Institution:** University of Buea · Faculty of Engineering & Technology · Computer Engineering
**Project:** *Modeling and Administration of a National Online Voting System according to the Electoral Code of Cameroon*
**Group:** 01 · **Instructor:** Dr Hughes Marie Kamdjou

---

## What this is

This repository is the **database / persistence layer** for the NOVS-CMR system. It is the
foundation a future **React + Node.js** application will be built on top of — so it ships not
just as raw scripts but as a set of reusable **Mongoose models** (`src/models`) and
**services** (`src/services`) the application can `require()` directly.

It implements **Section IV (Implementation)** and **Section V (Administration & Optimization)**
of the assignment:

- a physical schema of **18 collections** with `$jsonSchema` validators,
- a full indexing strategy (integrity + performance + TTL),
- domain models and transaction/consistency services,
- a deterministic seed dataset,
- the required query suite (search / add / modify / delete / recovery / parameterized),
- administration scripts (RBAC, `explain` performance monitoring, archiving/purging),
- Windows backup & restore utilities,
- and relational-algebra + SQL documentation for every query.

> ⚠️ **Academic / development build.** Authentication is off by default and the seeded RBAC
> users use placeholder passwords. See [Security notes](#security-notes) before any real use.

---

## Prerequisites (Windows 11)

| Tool | Version | Notes |
|------|---------|-------|
| **MongoDB Community Server** | 8.x | Running locally on `127.0.0.1:27017`. Install as a Windows service or run `mongod` manually. |
| **mongosh** (MongoDB Shell) | 2.x | Used by the `.mongosh.js` scripts. Usually bundled with the server installer; otherwise install separately. |
| **Node.js** | ≥ 18 LTS | Runs the Mongoose seed/services and the Node query scripts. |
| **PowerShell** | 7+ (`pwsh`) | Only needed for the backup/restore scripts. |
| **MongoDB Database Tools** | optional | `mongodump`/`mongorestore`. If **not** installed, backup falls back to a logical (JSON + clone-DB) mode that works without them. |

Verify your tools:

```powershell
mongod --version
mongosh --version
node --version
pwsh --version
```

---

## Quick start

```powershell
# 1. install Node dependencies
npm install

# 2. create your local env file (PowerShell)
Copy-Item .env.example .env          # adjust MONGO_URI / BACKUP_DIR if needed

# 3. make sure MongoDB is running, then build the database:
npm run schema                       # collections + validators + indexes
npm run seed                         # deterministic sample data

# 4. (optional) explore it
npm run q:search                     # the five search queries
npm run consistency                  # integrity invariants
```

That's the whole database stood up. Everything below is detail.

---

## Project layout

```
NOVS-CMR/
├─ src/
│  ├─ config/db.js                 # Mongoose connect()/disconnect() helper
│  ├─ models/                      # 17 Mongoose models + index.js (the app's data layer)
│  └─ services/
│     ├─ transactionService.js     # submitVote / approveCandidate / publishNationalResult
│     └─ consistencyService.js     # ballot/result/duplicate-id invariants
├─ scripts/
│  ├─ schema/create-schema.mongosh.js   # 18 collections + $jsonSchema validators
│  ├─ admin/
│  │  ├─ indexes.mongosh.js              # all indexes (integrity + perf + TTL)
│  │  ├─ performance-explain.mongosh.js  # explain() + before/after index demo
│  │  └─ archive-purge.mongosh.js        # hot→cold ballot archiving
│  ├─ security/setup-roles.mongosh.js    # MongoDB RBAC roles + service users
│  ├─ seed/seed.js                       # deterministic sample dataset
│  ├─ queries/                           # 01..06 — the Section V query suite
│  ├─ demo/                              # transaction-demo.js, consistency-demo.js
│  └─ backup/                            # backup.ps1, restore.ps1 (PowerShell)
├─ docs/
│  ├─ QUERY-REFERENCE.md           # relational-algebra trees + SQL for every query
│  └─ ADMIN-OPTIMIZATION.md        # indexing / RBAC / transactions / backup / scaling
├─ .env.example
└─ package.json
```

---

## The data model (18 collections)

| Collection | Purpose |
|------------|---------|
| `electoral_districts` | geographic electoral divisions |
| `elecam_branches` | ELECAM regional/divisional offices |
| `political_parties` | registered parties |
| `polling_stations` | physical voting stations |
| `polling_officials` | station staff |
| `voters` | the electoral register (citizens) |
| `elections` | election events (e.g. `PRES-2025`) |
| `candidates` | nominations per election (party-backed or independent) |
| `voter_participation` | **who voted** (identity) — unique per voter+election |
| `votes` | **anonymous ballots** — *no voter reference* (ballot secrecy) |
| `results` | aggregated tallies per scope (station/district/national) |
| `facial_verifications` | biometric (Rekognition-style) check metadata; TTL 90d |
| `polling_reports` | end-of-day station reports |
| `blockchain_records` | immutable audit references (Hyperledger-style) |
| `roles` | application-level permission sets |
| `user_accounts` | application logins (with lockout tracking) |
| `audit_logs` | security/operational audit trail |
| `archived_votes` | cold storage for purged historical ballots |

**Key design decisions** (detailed in [`docs/ADMIN-OPTIMIZATION.md`](docs/ADMIN-OPTIMIZATION.md)):
- *Ballot secrecy* — `voter_participation` (identity) and `votes` (anonymous) are separate
  collections, so the system can prove a voter voted exactly once **without** linking them to
  their ballot.
- *Integrity via unique indexes* — the one-vote-per-voter rule is enforced by a unique
  `{voter, election}` index on `voter_participation`, which holds even on a standalone server
  without transactions.

---

## Running everything (npm scripts)

| Command | What it does | Maps to report |
|---------|--------------|----------------|
| `npm run schema` | Create the 18 collections + validators, then build all indexes | §IV schema |
| `npm run seed` | Wipe & repopulate deterministic sample data (via Mongoose) | §IV data |
| `npm run indexes` | (Re)build indexes only | §V indexing |
| `npm run security` | Create MongoDB RBAC roles + service users | §V security |
| `npm run q:search` | Five search queries (one per table) | §V queries |
| `npm run q:add` | Five data-addition queries | §V queries |
| `npm run q:modify` | Five updates + five modifications | §V queries |
| `npm run q:delete` | Two scoped deletion queries | §V queries |
| `npm run q:recover` | Two recovery queries (replay + backup restore) | §V recovery |
| `npm run q:params` | Five parameterized queries (Node/Mongoose) | §V parameterized |
| `npm run perf` | `explain()` plans + before/after index demo | §V performance |
| `npm run archive` | Archive & purge old ballots to cold storage | §V scalability |
| `npm run tx:demo` | Demonstrate the transaction service | §V transactions |
| `npm run consistency` | Run data-integrity invariants | §V consistency |

> **Connection string.** Node scripts read `MONGO_URI` from `.env` via `dotenv`. The
> `mongosh` scripts target the `novs_cmr` database directly. If your MongoDB is not on the
> default `127.0.0.1:27017`, either edit `.env` or pass the URI explicitly, e.g.
> `mongosh "mongodb://host:port/novs_cmr" scripts/queries/01-search-queries.mongosh.js`.

### Backup & restore (PowerShell)

```powershell
pwsh scripts/backup/backup.ps1                       # auto: full if mongodump exists, else logical
pwsh scripts/backup/backup.ps1 -Mode full -BackupDir C:\NOVS-Backups
pwsh scripts/backup/restore.ps1 -Mode clone          # restore from the novs_cmr_backup clone
pwsh scripts/backup/restore.ps1 -Mode full -DumpDir C:\NOVS-Backups\dump-YYYYMMDD-HHMMSS
```

The **logical** backup also refreshes a `novs_cmr_backup` database — that clone is what the
`q:recover` (R2) query restores a deleted document from.

---

## Recommended end-to-end run

```powershell
npm install
Copy-Item .env.example .env
npm run schema
npm run seed
npm run q:search
npm run q:add
npm run q:modify
npm run q:delete
npm run perf
npm run archive
npm run tx:demo
npm run consistency
pwsh scripts/backup/backup.ps1        # creates novs_cmr_backup clone
npm run q:recover                     # R1 replay + R2 restore-from-clone
npm run security                      # last: creates DB users (optional)
```

---

## Using the database from the future application

The models are plain Mongoose and ready to import:

```js
const { connect, disconnect } = require('./src/config/db');
const M = require('./src/models');
const { submitVote } = require('./src/services/transactionService');

await connect();
const voter = await M.Voter.findOne({ nationalIdNumber: 'NID-50003' });
// ... submitVote(...) enforces eligibility, one-vote, ballot secrecy, and audit logging
await disconnect();
```

See [`scripts/queries/06-parameterized-queries.js`](scripts/queries/06-parameterized-queries.js)
for ready-made, injection-safe query functions the API layer can reuse verbatim.

---

## Security notes

- **Placeholder passwords.** `scripts/security/setup-roles.mongosh.js` creates DB users with
  passwords like `ChangeMe_App_2026`. **Change every one of them** before any non-local use,
  and store real secrets outside source control.
- **Enable authentication.** RBAC only takes effect once `security.authorization: enabled` is
  set in `mongod.cfg` and `mongod` is restarted (the script prints the exact steps). After
  that, point `MONGO_URI` at the `novs_app` service account.
- **Least privilege.** The `auditor` role is read-only; registration/admin roles are scoped to
  their collections. Don't run the app as an admin user.
- `.env` is git-ignored — keep it that way.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `MongoServerSelectionError` / connection timeout | `mongod` isn't running, or `MONGO_URI` host/port is wrong. Start the service: `net start MongoDB`. |
| `'mongosh' is not recognized` | mongosh isn't on `PATH`. Reinstall the MongoDB Shell or add its folder to `PATH`. |
| `Document failed validation` on seed | Schema not applied yet, or out of date. Run `npm run schema` **before** `npm run seed`. |
| Transactions "not supported" in `tx:demo` | Expected on a **standalone** server — the service falls back to sequential writes and relies on unique indexes. Use a replica set for true ACID transactions. |
| `mongodump`/`mongorestore` not found | Install *MongoDB Database Tools*, or just use the default logical backup mode (no tools required). |
| `q:recover` says "backup DB not found" | Run `pwsh scripts/backup/backup.ps1` first to create the `novs_cmr_backup` clone. |
| `%MONGO_URI%` appears literally | You ran a `mongosh` script in a shell that didn't expand it — harmless (scripts target `novs_cmr` directly), or pass the URI explicitly. |

---

## Mapping to the report

| Report section | Where it lives |
|----------------|----------------|
| IV — Physical schema & data | `scripts/schema/`, `scripts/seed/`, `src/models/` |
| V — Indexing & performance | `scripts/admin/indexes.mongosh.js`, `…/performance-explain.mongosh.js`, [`docs/ADMIN-OPTIMIZATION.md`](docs/ADMIN-OPTIMIZATION.md) |
| V — Security / RBAC | `scripts/security/setup-roles.mongosh.js` |
| V — Transactions & consistency | `src/services/`, `scripts/demo/` |
| V — Query suite (+ algebra & SQL) | `scripts/queries/`, [`docs/QUERY-REFERENCE.md`](docs/QUERY-REFERENCE.md) |
| V — Backup / recovery | `scripts/backup/`, `scripts/queries/05-recovery-queries.mongosh.js` |
| V — Archiving & scalability | `scripts/admin/archive-purge.mongosh.js`, [`docs/ADMIN-OPTIMIZATION.md`](docs/ADMIN-OPTIMIZATION.md) §6–7 |
