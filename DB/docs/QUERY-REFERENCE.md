# NOVS-CMR — Query Reference

**Relational-algebra trees and tuned SQL equivalents for every query required by Section V of the assignment.**

This document is the bridge between the *conceptual / relational* design taught in the
course and the *document-database* implementation that actually ships. For each query we give:

1. a one-line justification (why the system needs it),
2. the **MongoDB** statement that runs in the implementation,
3. the **relational-algebra** expression (and an ASCII operator tree),
4. the **tuned SQL** equivalent (as it would run on a relational engine such as PostgreSQL),
5. the index that makes it fast.

The MongoDB statements live in [`scripts/queries/`](../scripts/queries); this file is the
relational specification of those same operations.

> **Notation.** σ = selection (WHERE), π = projection (SELECT columns),
> ⋈ = natural/θ join (`$lookup`), 𝛾 = grouping/aggregation (`GROUP BY` / `$group`),
> τ = sort (`ORDER BY` / `$sort`), ρ = rename. Collections map to tables; an
> `ObjectId` reference maps to a foreign key.

---

## Logical schema (relational view of the document model)

The document model is normalised enough that it maps cleanly onto tables. The columns
below are the ones used by the queries in this file.

```
electoral_districts(_id PK, districtCode UQ, name, region)
elecam_branches(_id PK, branchCode UQ, name, district FK->electoral_districts)
political_parties(_id PK, partyCode UQ, acronym, name)
polling_stations(_id PK, stationCode UQ, name, district FK->electoral_districts,
                 registeredVoterCount, status)
voters(_id PK, voterNumber UQ, nationalIdNumber UQ, fullName, dateOfBirth, gender,
       district FK->electoral_districts, pollingStation FK->polling_stations,
       biometricStatus, registrationDate, accountLocked, channelPreference)
elections(_id PK, electionCode UQ, title, type, status, startDate, endDate)
candidates(_id PK, candidateNumber UQ, voter FK->voters, election FK->elections,
           party FK->political_parties NULLABLE, district FK->electoral_districts,
           status, approvedBy, approvedAt)
voter_participation(_id PK, voter FK->voters, election FK->elections, votedAt)   -- UQ(voter,election)
votes(_id PK, election FK->elections, candidate FK->candidates,
      pollingStation FK->polling_stations, district FK->electoral_districts,
      ballotToken, valid, castAt)                                                -- NO voter FK (ballot secrecy)
results(_id PK, election FK->elections, level, pollingStation FK, district FK,
        candidateTotals[], totalValidVotes, totalInvalidVotes, status)
facial_verifications(_id PK, voter FK->voters, sessionId, livenessScore,
                     similarityScore, status, capturedAt)
polling_reports(_id PK, pollingStation FK, election FK, totalVotes, validVotes, invalidVotes)
blockchain_records(_id PK, txRef UQ, txType, payloadHash, endorsers[], timestamp,
                   relatedEntityType, relatedEntityId)
roles(_id PK, roleName UQ, permissions[])
user_accounts(_id PK, username UQ, role FK->roles, status, failedLoginAttempts)
audit_logs(_id PK, actor, action, entityType, entityId, outcome, timestamp)
```

---

## Part 1 — Five search queries (one per table, each justified)

### S1 — Locate a voter by national ID  *(table: voters)*

**Why:** identity verification at login/registration is the single most frequent lookup.

**MongoDB** ([01-search-queries.mongosh.js](../scripts/queries/01-search-queries.mongosh.js))
```js
db.voters.find(
  { nationalIdNumber: 'NID-50003' },
  { voterNumber: 1, fullName: 1, biometricStatus: 1, pollingStation: 1 }
)
```

**Relational algebra**
```
π voterNumber, fullName, biometricStatus, pollingStation (
    σ nationalIdNumber = 'NID-50003' (voters)
)
```
```
        π (voterNumber, fullName, biometricStatus, pollingStation)
                              |
        σ (nationalIdNumber = 'NID-50003')
                              |
                          voters
```

**Tuned SQL**
```sql
SELECT voter_number, full_name, biometric_status, polling_station
FROM   voters
WHERE  national_id_number = 'NID-50003';   -- point lookup
```
**Index used:** `voters.nationalIdNumber_1` (UNIQUE) → single-row index seek.

---

### S2 — Approved candidates for an election, joined to person and party  *(table: candidates)*

**Why:** building the ballot requires every APPROVED candidate joined to the person and the sponsoring party.

**MongoDB** — `$match → $lookup(voters) → $lookup(political_parties) → $unwind → $project`.

**Relational algebra**
```
π candidateNumber, voters.fullName, COALESCE(parties.acronym,'INDEPENDENT') (
    ( σ status='APPROVED' ∧ election=:eid (candidates) )
      ⋈ candidates.voter = voters._id  voters
      ⟕ candidates.party = parties._id political_parties      -- ⟕ = LEFT outer (party is nullable)
)
```
```
                          π (candidateNumber, fullName, acronym|'INDEPENDENT')
                                          |
                                         ⟕  (LEFT JOIN political_parties ON party)
                                        /  \
                                      ⋈     political_parties
                            (JOIN voters ON voter)
                                    /   \
              σ(status='APPROVED' ∧     voters
                election=:eid)
                    |
                candidates
```

**Tuned SQL**
```sql
SELECT c.candidate_number,
       v.full_name,
       COALESCE(p.acronym, 'INDEPENDENT') AS party
FROM   candidates c
JOIN   voters v            ON v._id = c.voter
LEFT   JOIN political_parties p ON p._id = c.party
JOIN   elections e         ON e._id = c.election
WHERE  e.election_code = 'PRES-2025'
AND    c.status = 'APPROVED';
```
**Index used:** `candidates.election_1_status_1` (compound) drives the σ; PK indexes on `voters`/`political_parties` drive the joins.

---

### S3 — Polling stations of a district with registered-voter load  *(table: polling_stations)*

**Why:** operational planning needs every station of a district together with its registered-voter load.

**MongoDB** — `$lookup(electoral_districts) → $unwind → $match(districtCode) → $project`.

**Relational algebra**
```
π stationCode, name, registeredVoterCount, districts.name (
    σ districts.districtCode = 'SW-FAKO' (
        polling_stations ⋈ polling_stations.district = districts._id  electoral_districts
    )
)
```
```
        π (stationCode, name, registeredVoterCount, district.name)
                              |
            σ (district.districtCode = 'SW-FAKO')
                              |
                             ⋈  (JOIN electoral_districts ON district)
                            /  \
              polling_stations  electoral_districts
```

**Tuned SQL**
```sql
SELECT ps.station_code, ps.name, ps.registered_voter_count, d.name AS district
FROM   polling_stations ps
JOIN   electoral_districts d ON d._id = ps.district
WHERE  d.district_code = 'SW-FAKO';
```
**Index used:** `electoral_districts.districtCode_1` (UNIQUE) then `polling_stations.district_1`.

---

### S4 — Live valid-vote tally per candidate  *(table: votes)*

**Why:** result aggregation is the core analytical query; it groups the high-volume `votes` collection by candidate.

**MongoDB** — `$match(election, valid:true) → $group(candidate, $sum) → $sort`.

**Relational algebra**
```
τ votes DESC (
    candidate 𝛾 count(*)→votes (
        σ election=:eid ∧ valid=true (votes)
    )
)
```
```
            τ (votes DESC)
                  |
        𝛾 candidate; COUNT(*)→votes
                  |
        σ (election=:eid ∧ valid=true)
                  |
                votes
```

**Tuned SQL**
```sql
SELECT candidate, COUNT(*) AS votes
FROM   votes
WHERE  election = :eid
AND    valid = TRUE
GROUP  BY candidate
ORDER  BY votes DESC;
```
**Index used:** `votes.election_1_candidate_1` — the compound index lets the group be served from an index scan (covered for the `election` predicate, grouped by `candidate`).

---

### S5 — Result-publication audit references, newest first  *(table: blockchain_records)*

**Why:** auditors must retrieve immutable proof of every result publication, newest first.

**MongoDB**
```js
db.blockchain_records.find(
  { txType: 'RESULT_PUBLICATION' },
  { _id: 0, txRef: 1, payloadHash: 1, endorsers: 1, timestamp: 1 }
).sort({ timestamp: -1 })
```

**Relational algebra**
```
τ timestamp DESC (
    π txRef, payloadHash, endorsers, timestamp (
        σ txType = 'RESULT_PUBLICATION' (blockchain_records)
    )
)
```
```
            τ (timestamp DESC)
                  |
        π (txRef, payloadHash, endorsers, timestamp)
                  |
        σ (txType = 'RESULT_PUBLICATION')
                  |
            blockchain_records
```

**Tuned SQL**
```sql
SELECT tx_ref, payload_hash, endorsers, timestamp
FROM   blockchain_records
WHERE  tx_type = 'RESULT_PUBLICATION'
ORDER  BY timestamp DESC;
```
**Index used:** `blockchain_records.txType_1_timestamp_-1` — the σ and the τ are both served by the one compound index (no sort step).

---

## Part 2 — Five data-addition queries

([02-add-queries.mongosh.js](../scripts/queries/02-add-queries.mongosh.js))

| # | Operation | SQL equivalent |
|---|-----------|----------------|
| A1 | Register a new voter | `INSERT INTO voters (voter_number, national_id_number, full_name, date_of_birth, gender, district, polling_station, registration_date, biometric_status, account_locked) VALUES ('V-9001','NID-99001','New Registrant','2000-01-15','F', :fako, :station, NOW(), 'PENDING', FALSE);` |
| A2 | Record a facial verification | `INSERT INTO facial_verifications (voter, session_id, liveness_score, similarity_score, status, reference_image_key, captured_at) VALUES (:v9001,'FL-V-9001',97.4,98.1,'PASS','s3://novs-faces/V-9001.jpg', NOW());` |
| A3 | Submit a candidate nomination | `INSERT INTO candidates (candidate_number, voter, election, party, district, manifesto_summary, status, nomination_date) VALUES ('C-900', :v9001, :election, NULL, :fako, 'Youth empowerment', 'SUBMITTED', NOW());` |
| A4 | Create an end-of-day polling report | `INSERT INTO polling_reports (polling_station, election, submitted_by, total_votes, valid_votes, invalid_votes, signed_by, submitted_at) VALUES (:station, :election, 'poll.buea001', 4, 3, 1, 'Enow Agbor', NOW());` |
| A5 | Write a security audit-log entry | `INSERT INTO audit_logs (actor, action, entity_type, entity_id, "timestamp", ip_address, outcome) VALUES ('officer.buea','VOTER_REGISTERED','Voter', :v9001, NOW(), '10.0.0.21','SUCCESS');` |

> The unique indexes (`voter_number`, `national_id_number`, `candidate_number`, …) are the
> relational-algebra equivalent of `PRIMARY KEY` / `UNIQUE` constraints: a duplicate insert
> raises `E11000` in MongoDB exactly as it raises a unique-violation in SQL.

---

## Part 3 — Five updates + five modifications

([03-modify-queries.mongosh.js](../scripts/queries/03-modify-queries.mongosh.js))

### Group A — five targeted state-transition UPDATEs

| # | Operation | SQL equivalent |
|---|-----------|----------------|
| U1 | Verify a voter biometric | `UPDATE voters SET biometric_status='VERIFIED' WHERE voter_number='V-1010';` |
| U2 | Approve a candidate | `UPDATE candidates SET status='APPROVED', approved_by='admin.electoral', approved_at=NOW() WHERE candidate_number='C-002';` |
| U3 | Open the election | `UPDATE elections SET status='OPEN' WHERE _id=:eid;` |
| U4 | Seal a polling station | `UPDATE polling_stations SET status='SEALED', closing_time=NOW() WHERE station_code='PS-FAKO-002';` |
| U5 | Lock a user account | `UPDATE user_accounts SET status='LOCKED', failed_login_attempts = failed_login_attempts + 1 WHERE username='officer.buea';` |

### Group B — five bulk / structural MODIFICATIONs

| # | Operation | SQL equivalent |
|---|-----------|----------------|
| M1 | Bulk reassign voters between stations | `UPDATE voters SET polling_station=:to WHERE polling_station=:from;` |
| M2 | Recompute denormalised station counts | `UPDATE polling_stations ps SET registered_voter_count = (SELECT COUNT(*) FROM voters v WHERE v.polling_station = ps._id);` |
| M3 | Append a candidate total to a result (`$addToSet`) | `INSERT INTO result_candidate_totals (result_id, candidate, votes) SELECT r._id, :cand, 0 FROM results r WHERE r.election=:eid AND r.level='STATION' ON CONFLICT (result_id, candidate) DO NOTHING;` |
| M4 | Schema evolution: backfill a new column | `UPDATE voters SET channel_preference='ONLINE' WHERE channel_preference IS NULL;` *(in MongoDB: `channelPreference: {$exists:false}`)* |
| M5 | Conditional bulk correction (invalidate late ballots) | `UPDATE votes SET valid=FALSE WHERE district=:fako AND cast_at > :election_end;` |

> M3 illustrates a difference worth noting in the report: in the relational model the
> embedded `candidateTotals[]` array is a separate child table with a composite unique key,
> and `$addToSet` becomes `INSERT … ON CONFLICT DO NOTHING`.

---

## Part 4 — Two deletion queries

([04-delete-queries.mongosh.js](../scripts/queries/04-delete-queries.mongosh.js))

| # | Operation | SQL equivalent |
|---|-----------|----------------|
| D1 | Remove rejected candidate nominations | `DELETE FROM candidates WHERE status='REJECTED';` |
| D2 | Purge stale failed facial verifications (>90 days) | `DELETE FROM facial_verifications WHERE status='FAIL' AND captured_at < NOW() - INTERVAL '90 days';` |

> Votes, participations, results and audit logs are **never** physically deleted — the
> relational equivalent would be revoking `DELETE` privilege on those tables and using a
> soft-delete/`valid=FALSE` flag instead.

---

## Part 5 — Two recovery queries

([05-recovery-queries.mongosh.js](../scripts/queries/05-recovery-queries.mongosh.js))

### R1 — Rebuild a lost aggregate by replay (recompute the result from votes)

Votes are append-only and immutable, so a corrupted/lost `results` row can always be
recomputed from the source of truth.

```sql
-- Recompute NATIONAL tally and UPSERT it back:
INSERT INTO results (election, level, candidate_totals, total_valid_votes,
                     total_invalid_votes, status, published_at)
SELECT :eid, 'NATIONAL',
       jsonb_agg(jsonb_build_object('candidate', candidate, 'votes', n)),
       SUM(n),
       (SELECT COUNT(*) FROM votes WHERE election=:eid AND valid=FALSE),
       'VERIFIED', NOW()
FROM ( SELECT candidate, COUNT(*) n FROM votes
       WHERE election=:eid AND valid=TRUE GROUP BY candidate ) t
ON CONFLICT (election, level) DO UPDATE
SET candidate_totals = EXCLUDED.candidate_totals,
    total_valid_votes = EXCLUDED.total_valid_votes,
    total_invalid_votes = EXCLUDED.total_invalid_votes,
    status = 'VERIFIED', published_at = NOW();
```

### R2 — Restore an accidentally deleted row from a backup database

```sql
-- novs_cmr_backup is the logical-backup clone created by scripts/backup/backup.ps1
INSERT INTO novs_cmr.voters
SELECT * FROM novs_cmr_backup.voters b
WHERE  b.voter_number = 'V-1000'
AND    NOT EXISTS (SELECT 1 FROM novs_cmr.voters l WHERE l.voter_number = b.voter_number);
```

---

## Part 6 — Five parameterized queries (prepared statements)

([06-parameterized-queries.js](../scripts/queries/06-parameterized-queries.js))

A parameterized query passes bind values to the driver as **data**, never as
string-concatenated SQL — that is what defeats injection. The Node functions in
`06-parameterized-queries.js` are exactly this; below are the matching **PL/pgSQL**
function signatures the future application could call instead.

```sql
-- P1: find a voter by national id
CREATE FUNCTION find_voter_by_national_id(p_national_id TEXT)
RETURNS TABLE(voter_number TEXT, full_name TEXT, biometric_status TEXT) AS $$
  SELECT voter_number, full_name, biometric_status
  FROM voters WHERE national_id_number = p_national_id;
$$ LANGUAGE sql STABLE;

-- P2: approved candidates for an election
CREATE FUNCTION approved_candidates(p_election_code TEXT)
RETURNS TABLE(candidate_number TEXT, full_name TEXT, party TEXT) AS $$
  SELECT c.candidate_number, v.full_name, COALESCE(p.acronym,'INDEPENDENT')
  FROM candidates c
  JOIN elections e ON e._id = c.election AND e.election_code = p_election_code
  JOIN voters v    ON v._id = c.voter
  LEFT JOIN political_parties p ON p._id = c.party
  WHERE c.status = 'APPROVED';
$$ LANGUAGE sql STABLE;

-- P3: vote tally for an election
CREATE FUNCTION tally_by_candidate(p_election_code TEXT)
RETURNS TABLE(candidate TEXT, votes BIGINT) AS $$
  SELECT vo.candidate, COUNT(*)
  FROM votes vo JOIN elections e ON e._id = vo.election
  WHERE e.election_code = p_election_code AND vo.valid = TRUE
  GROUP BY vo.candidate ORDER BY 2 DESC;
$$ LANGUAGE sql STABLE;

-- P4: voters registered in a district within a date range
CREATE FUNCTION voters_registered_between(p_district_code TEXT, p_from DATE, p_to DATE)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM voters v JOIN electoral_districts d ON d._id = v.district
  WHERE d.district_code = p_district_code
  AND v.registration_date BETWEEN p_from AND p_to;
$$ LANGUAGE sql STABLE;

-- P5: most recent audit-trail page for an actor
CREATE FUNCTION audit_trail(p_actor TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE(action TEXT, entity_type TEXT, outcome TEXT, ts TIMESTAMPTZ) AS $$
  SELECT action, entity_type, outcome, "timestamp"
  FROM audit_logs WHERE actor = p_actor
  ORDER BY "timestamp" DESC LIMIT p_limit;
$$ LANGUAGE sql STABLE;
```

---

## Appendix — Index ↔ constraint cross-reference

| Relational concept | MongoDB index (see [indexes.mongosh.js](../scripts/admin/indexes.mongosh.js)) |
|--------------------|-------------------------------------------------------------------------------|
| `PRIMARY KEY` | the mandatory `_id` index on every collection |
| `UNIQUE(national_id_number)` | `voters.nationalIdNumber_1 {unique}` |
| `UNIQUE(voter, election)` one-vote rule | `voter_participation.{voter,election} {unique}` |
| `UNIQUE(voter, election)` one-candidacy rule | `candidates.{voter,election} {unique}` |
| composite result key | `results.{election,level,pollingStation,district} {unique, partial}` |
| FK lookup index | `votes.{election,candidate}`, `voters.district`, `candidates.{election,status}`, … |
| `ORDER BY ts DESC` covering | `blockchain_records.{txType,timestamp:-1}`, `audit_logs.{actor,timestamp:-1}` |
| row TTL / retention policy | `facial_verifications.capturedAt {expireAfterSeconds: 90d}` (`fv_ttl_90d`) |
