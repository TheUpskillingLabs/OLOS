# Production Data‑Regression Recovery Runbook

**Incident:** 2026‑07‑13 — OLOS production regressed to old data
**Status:** recovery not yet executed (this is the plan)
**Owner of this doc:** whoever runs the restore; update the checklist inline as you go.

---

## 1. What happened (one‑paragraph summary)

At **~02:00–02:08 UTC on 2026‑07‑13**, the OLOS **production** database
(`cdbgkgkjnomjnpicaxqe`, "OLOS‑prod", us‑west‑1) had its `public` schema
**overwritten with a copy of the OLOS‑dev database** (`cethihabtddiujzayaxe`,
us‑east‑2) — a stale snapshot whose data ends ~**Jul 9** — and its `auth`
schema **wiped**. Evidence: prod and dev now hold byte‑identical data (54
participants newest `2026‑07‑06 19:39:58.961671`, 112 pulse_checks newest
`2026‑07‑09 16:32:33.460266`, single cycle `Energy & Climate`, empty
`field_surveys`/`survey_responses`/`learning_logs`), the Postgres instance
never restarted (so it was a **live logical operation**, not a PITR/branch),
`owner_actions` is empty (not the in‑app reset RPCs), and there was **no
production deploy** in the window. First post‑incident re‑signup landed at
**02:08:01 UTC**.

The **real** production data (Cycle 3 "Civics & Elections", the real user
roster, the 31 Civics survey responses, learning logs, recent enrollments and
pulse checks) exists **only in Supabase's backups** now. This runbook restores
it.

---

## 2. Recovery target & known trade‑off

| Item | Value |
|---|---|
| Project to restore | **OLOS‑prod** — ref `cdbgkgkjnomjnpicaxqe` (us‑west‑1). **Not** `cethihabtddiujzayaxe` (that is dev). |
| Restore point (ideal) | **2026‑07‑13 02:05:00 UTC** — as late as possible while still **before 02:08:00** (the first re‑signup / overwrite completion). If unsure, use **02:00:00 UTC**. |
| Data discarded by restoring to that point | **5 `auth.users` + 5 `follows`** created after 02:00 — the only writes since the incident. Nothing else. See §6 for the exact list to preserve/notify. |
| App impact | Prod ref / URL / API keys are **unchanged** by an in‑place restore, so **no Vercel env changes needed**. Expect a few minutes of downtime during the restore. |

The discard cost is effectively nil (five people simply sign in again), which
is why the simple **in‑place PITR (Path A)** is recommended over the surgical
merge (Path B).

---

## 3. Pre‑flight checklist (do all of these BEFORE restoring)

- [ ] **3.1 Confirm backup availability & granularity.** Supabase Dashboard →
  OLOS‑prod → **Database → Backups**.
  - If **Point‑in‑Time Recovery** is enabled: confirm the recoverable window
    covers `2026‑07‑13 02:05 UTC`. Target that timestamp.
  - If **only daily physical backups** exist: identify the newest daily
    **before 02:08 UTC Jul 13**. Note its exact time — any *real* prod writes
    between that daily and 02:08 are **not** recoverable from it (quantify the
    gap in §7 before deciding). PITR is strongly preferred; if it isn't on,
    weigh Path B.
- [ ] **3.2 Snapshot the CURRENT (post‑incident) prod first.** Take a manual
  backup of prod *as it is now* (Dashboard → Backups → "Backup now", or
  `supabase db dump`), so the restore is itself reversible and the 5
  re‑signins/follows are retrievable. **Do not skip this.**
- [ ] **3.3 Record the post‑incident signups** to notify later (run against
  prod, save the output somewhere durable):
  ```sql
  SELECT id, email, created_at, last_sign_in_at
  FROM auth.users WHERE created_at >= '2026-07-13 02:00:00+00' ORDER BY created_at;
  -- and the follows that will be dropped:
  SELECT id, follower_id, followed_type, followed_id, created_at
  FROM follows WHERE created_at >= '2026-07-13 02:00:00+00' ORDER BY created_at;
  ```
- [ ] **3.4 Freeze further divergence.** Put prod in maintenance or disable new
  sign‑ins for the restore window (a Vercel maintenance flag, or temporarily
  pause the project) so no one writes mid‑restore and the cutover is clean.
- [ ] **3.5 Announce a short maintenance window** to the team (a few minutes of
  downtime).
- [ ] **3.6 Verify you are targeting the right project** one more time: the
  restore UI must show project **`cdbgkgkjnomjnpicaxqe` / OLOS‑prod / us‑west‑1**.

---

## 4. Path A — in‑place Point‑in‑Time Recovery (recommended)

1. [ ] Supabase Dashboard → **OLOS‑prod (`cdbgkgkjnomjnpicaxqe`)** → Database →
   Backups → **Point in Time**.
2. [ ] Select **2026‑07‑13 02:05:00 UTC** (adjust the dashboard's timezone
   control carefully — enter the equivalent local time for 02:05 **UTC**).
3. [ ] Start the restore. The project rewinds to that instant; wait for status
   **ACTIVE_HEALTHY**.
4. [ ] Run the **§5 verification** queries. If they pass, proceed to §6 cutover.
   If they fail (wrong data), do **not** lift maintenance — escalate and
   consider Path B or a different restore point.

> In‑place restore keeps the same project ref, connection string, and API keys,
> so the Vercel app reconnects with no config change once the DB is healthy.

---

## 5. Post‑restore verification (must all pass)

Run against OLOS‑prod after the restore completes. Expected results assume the
restore point is ~02:05 UTC Jul 13.

```sql
-- 5.1 Cycle 3 is back (not just Energy & Climate id=1)
SELECT id, name, status FROM cycles ORDER BY id;
--   expect a "Civics & Elections" cycle present; Energy & Climate at its real id (~3)

-- 5.2 Real auth roster restored (should be MANY more than 5)
SELECT count(*) AS auth_users, min(created_at) AS oldest, max(created_at) AS newest
FROM auth.users;

-- 5.3 Civics survey data restored (was 0/0/0 during the incident)
SELECT
  (SELECT count(*) FROM field_surveys)            AS field_surveys,
  (SELECT count(*) FROM survey_responses)         AS survey_responses,
  (SELECT count(*) FROM survey_response_answers)  AS survey_answers;   -- expect the ~31 Civics responses

-- 5.4 Data horizon advanced to ~Jul 13 (not Jul 6/Jul 9)
SELECT
  (SELECT max(created_at) FROM participants)  AS newest_participant,
  (SELECT max(created_at) FROM pulse_checks)  AS newest_pulse,
  (SELECT count(*)        FROM learning_logs) AS learning_logs,     -- expect > 0
  (SELECT count(*)        FROM cycle_enrollments) AS enrollments;

-- 5.5 No orphaned participant↔auth links
SELECT count(*) AS orphaned_participants
FROM participants
WHERE auth_user_id IS NOT NULL
  AND auth_user_id NOT IN (SELECT id FROM auth.users);   -- expect 0

-- 5.6 auth audit log is populated again (was empty during the incident)
SELECT count(*) AS auth_audit_rows FROM auth.audit_log_entries;     -- expect > 0
```

- [ ] Smoke test the live app: sign in as a known real member, confirm the
  **Cycle 3 "Civics & Elections"** dashboard renders, the directory shows the
  full roster, and a Civics survey response is visible.

---

## 6. Cutover & communications

- [ ] Lift maintenance / re‑enable sign‑ins (§3.4 reversed).
- [ ] Notify the **5 people who signed in during the incident window** (from
  §3.3 — `sandra@upskillinglabs.org`, `mjalan@gmail.com`,
  `mjalanconsulting@gmail.com`, `brendan@withlevy.com`, `amg@withlevy.com`)
  that they should sign in again; confirm their participant rows re‑link on
  next login (the restored `auth.users` rows carry the real identities, and the
  Google `sub` on next sign‑in reconciles).
- [ ] Post an incident note to the team channel with the restore point used and
  the verification results.

---

## 7. Path B — surgical merge (fallback only)

Use **only** if PITR granularity can't reach ~02:05, or you cannot accept even
the tiny §2 discard, or you need to keep the running site up throughout.

1. [ ] Restore the pre‑02:08 backup into a **separate** project (Supabase
   "restore to new project") or a **branch** — **never** over live prod.
2. [ ] Diff it against current prod to enumerate the lost rows: `cycles` (Cycle
   3) + `cycle_config`, `cycle_enrollments`, `cycle_agreements` /
   `agreement_acceptances`, `field_surveys` + `survey_responses` +
   `survey_response_answers`, `learning_logs`, post‑Jul‑9 `pulse_checks`, new
   `participants`, and the `auth.users` / `auth.identities` roster.
3. [ ] Re‑insert those rows into live prod in FK‑dependency order, resolving id
   sequence collisions and the `participants.auth_user_id → auth.users` linkage
   by hand. **This is significantly more error‑prone than Path A** (auth schema
   + serial sequences + FK graph) — script it, dry‑run it against the restored
   copy first, and have a second reviewer.

---

## 8. Root‑cause guardrails (do after recovery, before the next ops run)

The overwrite was a logical dev→prod data copy run against the live prod
instance. A contributing footgun: the ops tooling mislabels which project is
production.

- [ ] **Fix the stale prod ref.** `scripts/ops/CLAUDE.md` (§"Connection‑string
  guard") and `scripts/ops/reset-energy-participants.sql` (header) both call
  **`cethihabtddiujzayaxe` "the production project ref"** — but that ref is
  **OLOS‑dev** today; real prod is **`cdbgkgkjnomjnpicaxqe`**. Update every
  reference and the guard logic.
- [ ] **Audit the Supabase MCP connections.** The docs reference
  `mcp__supabase__` ("dev") and `mcp__supabase-prod__` ("prod"). Confirm each
  points where its name says, and consider removing prod **write** access from
  day‑to‑day tooling.
- [ ] **Enforce the typed‑confirmation guard** on any operation targeting prod
  (already mandated in `scripts/ops/CLAUDE.md`, but it keys off the wrong ref).
- [ ] **Confirm PITR is enabled** on OLOS‑prod going forward (it is the
  difference between minutes and days of loss next time).
- [ ] **File the incident write‑up** (timeline, root cause, action items) and
  identify who ran the dev→prod copy so the process gap is closed, not just the
  ref.

---

## Appendix — project reference (do not mix these up)

| Name | Ref | Region | Role |
|---|---|---|---|
| OLOS‑prod | `cdbgkgkjnomjnpicaxqe` | us‑west‑1 | **PRODUCTION** — restore target |
| OLOS‑dev | `cethihabtddiujzayaxe` | us‑east‑2 | dev (the source of the stale snapshot; do **not** restore over) |

Live site: `https://theupskillinglabs.org` → OLOS‑prod.
