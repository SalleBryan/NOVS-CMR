# NOVS-CMR — National Online Voting System (Cameroon)

**Full-stack implementation · CEF 476 Software Engineering & Design**
University of Buea · Faculty of Engineering & Technology · Computer Engineering · Group 01
Course instructor: Dr Hughes Marie Kamdjou

> *Design and implementation of a national online voting system according to the
> Electoral Code of Cameroon.*

This repository contains the complete system in three layers:

| Layer | Folder | Stack | What it is |
|-------|--------|-------|------------|
| **Database** | [`DB/`](DB) | MongoDB 8 + Mongoose | 18-collection electoral database, validators, indexes, transactions, RBAC, backup/recovery (the CEF 438 deliverable). |
| **Backend API** | [`server/`](server) | Node.js + Express | REST API enforcing the electoral workflow, JWT auth, role-based access, **Amazon Rekognition** facial scan, **Hyperledger Fabric** audit anchoring. |
| **Frontend** | [`client/`](client) | React + Vite | Minimalist, role-based web app with Cameroonian visual identity (flag tricolour + star). |

The backend **reuses the database layer directly** (`server/src/db.js` imports the
Mongoose models and connection from `DB/`), so the data model is defined in exactly
one place.

---

## Architecture

```
        React (Vite)  ──HTTP/JWT──▶  Express API  ──Mongoose──▶  MongoDB (novs_cmr)
        client/                      server/                     DB/  (18 collections)
                                       │  │
                  Amazon Rekognition ◀─┘  └─▶ Hyperledger Fabric (audit anchors)
                  (face presence /          (candidate approval, voter verification,
                   quality / liveness)       result submission & publication)
```

- **MongoDB** holds all operational data (voters, elections, candidates, anonymous
  ballots, results, …).
- **Amazon Rekognition** performs AI-assisted facial scanning (face presence, quality,
  confidence) during registration and before voting. *No person-specific recognition is
  claimed* — it is a presence/quality gate, exactly as scoped in the report.
- **Hyperledger Fabric** is the permissioned trust layer: only a hash + endorsement
  metadata is anchored for critical events; sensitive data stays in MongoDB.

Both external integrations **degrade gracefully**: with no AWS credentials the facial
scan uses a deterministic local analyser, and without a Fabric gateway the off-chain
pointer (in `blockchain_records`, tamper-evident via SHA-256) is the system of record.
This lets the whole app run offline for grading and demos.

---

## Prerequisites (Windows 11)

| Tool | Version | Notes |
|------|---------|-------|
| MongoDB Community Server | 8.x | running on `127.0.0.1:27017` |
| mongosh | 2.x | to build & seed the DB |
| Node.js | ≥ 18 (tested on 24) | runs API and Vite |
| npm | ≥ 9 | dependency management |
| A modern browser | — | Chrome/Edge for the webcam facial scan |

---

## Quick start (three terminals)

```powershell
# 0) one-time: build and seed the database (see DB/README.md for details)
cd DB
npm install
Copy-Item .env.example .env
npm run schema
npm run seed

# 1) backend API  (terminal A)
cd ..\server
npm install
Copy-Item .env.example .env
npm start                      # -> http://localhost:4000

# 2) frontend  (terminal B)
cd ..\client
npm install
npm run dev                    # -> http://localhost:5173
```

Open **http://localhost:5173** and sign in with the demo accounts below.

> The Vite dev server proxies `/api` to `http://localhost:4000`, so no CORS setup is
> needed in development.

---

## Demo accounts (created by `DB` seed)

All staff passwords are **`ChangeMe_2026`**.

| Portal | Username / credential | Role | Sees |
|--------|----------------------|------|------|
| Staff | `admin.system` | System Administrator | everything + user management |
| Staff | `admin.electoral` | Electoral Administrator | elections, candidates, results, ledger, audit |
| Staff | `officer.buea` | Registration Officer | voter register + biometric capture |
| Staff | `poll.buea001` | Polling Official | own station + reports |
| Staff | `auditor.nat` | Audit Reviewer | read-only audit + ledger |
| **Voter** | `V-1009` / `NID-50009` | Voter (verified) | can vote immediately |
| **Voter** | `V-1011` / `NID-50011` | Voter (pending) | must pass facial scan first |

Voters sign in with **voter number + national ID** (the facial scan is the verification
gate); staff sign in with **username + password**.

---

## Feature → report mapping

| Report requirement (Section) | Where it lives |
|------------------------------|----------------|
| Authentication & RBAC (FR 3.1) | `server/src/middleware/auth.js`, `services/authService.js` |
| Voter registration + biometric (FR 3.2) | `routes/voters.routes.js`, `pages/voters/*` |
| Candidate nomination & review (FR 3.3) | `routes/candidates.routes.js`, `pages/Candidates.jsx` |
| Election management (FR 3.4) | `routes/elections.routes.js`, `pages/Elections.jsx` |
| Polling-station management (FR 3.5) | `routes/stations.routes.js`, `pages/Stations.jsx` |
| **AI-assisted facial scan (FR 3.6)** | `services/rekognitionService.js`, `components/FacialCapture.jsx` |
| Online voting, one-vote, secrecy (FR 3.7) | `routes/votes.routes.js` → `DB` `transactionService.submitVote` |
| Result aggregation & publication (FR 3.8) | `routes/results.routes.js`, `pages/Results.jsx` |
| Dashboards & monitoring (FR 3.9) | `routes/dashboard.routes.js`, `pages/Dashboard.jsx` |
| **Blockchain anchoring (FR 3.10)** | `services/blockchainService.js`, `pages/Ledger.jsx` |
| Error handling & feedback (FR 3.10) | `middleware/error.js`, UI alerts everywhere |
| Reporting & query (FR 3.11) | list/filter endpoints + `pages/Audit.jsx` |

---

## Configuring the real integrations

Both are **optional** — the app runs without them.

### Amazon Rekognition (facial scan)
Edit `server/.env`:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```
When all three are present the backend calls the real `DetectFaces` API; otherwise it
uses the local analyser. The `/api/health` endpoint reports which mode is active
(`facialScanProvider`).

### Hyperledger Fabric (audit ledger)
Set `FABRIC_ENABLED=true` (plus channel/chaincode) in `server/.env`. The seam for a real
`fabric-network` gateway submission is marked in `server/src/services/blockchainService.js`.
Until then, anchors are written as tamper-evident off-chain pointers in MongoDB.

---

## API surface (selected)

```
POST /api/auth/staff/login            POST /api/auth/voter/login        GET  /api/auth/me
GET  /api/voters  POST /api/voters     PATCH /api/voters/:id            POST /api/voters/:id/lock
POST /api/facial/verify  (multipart image)        GET /api/facial/voter/:id
GET/POST /api/elections   PATCH /api/elections/:id
GET/POST /api/candidates  POST /api/candidates/:id/approve|reject
GET  /api/votes/status   POST /api/votes/cast
GET  /api/results/live (public)  GET /api/results  POST /api/results/publish
GET/POST /api/stations   PATCH /api/stations/:id   POST /api/stations/:id/report
GET  /api/blockchain   GET /api/blockchain/verify   GET /api/blockchain/status
GET  /api/audit          GET/POST /api/users   POST /api/users/:id/lock|unlock|disable|enable
GET  /api/dashboard/stats          GET /api/health
```

---

## Verified end-to-end

- Staff login (role-gated nav) and voter login (voter no. + national ID).
- Facial scan: PASS sets `biometricStatus = VERIFIED` and anchors a `VOTER_VERIFICATION`
  ledger record.
- Voting: eligibility → one-vote participation → **anonymous** ballot; a second attempt
  by the same voter is correctly rejected (HTTP 409).
- Candidate approval/rejection and national result publication write blockchain anchors.
- Live results aggregate from the `votes` collection; public results page needs no login.

---

## Security notes (before any real deployment)

- Change **all** seeded passwords (`ChangeMe_2026`) and the `JWT_SECRET` in `server/.env`.
- Enable MongoDB authentication (`DB/scripts/security/setup-roles.mongosh.js`) and point
  `MONGO_URI` at the `novs_app` service account.
- Serve over HTTPS and restrict `CLIENT_ORIGIN`.
- Face images are processed in memory only (never written to disk) and biometric metadata
  auto-expires after 90 days via the TTL index in the DB layer.

---

## Project documentation

- Database design, queries (relational algebra + SQL), administration & optimization:
  see [`DB/README.md`](DB/README.md), [`DB/docs/QUERY-REFERENCE.md`](DB/docs/QUERY-REFERENCE.md),
  [`DB/docs/ADMIN-OPTIMIZATION.md`](DB/docs/ADMIN-OPTIMIZATION.md).
- Backend env reference: [`server/.env.example`](server/.env.example).
