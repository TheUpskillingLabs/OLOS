# Civics & Elections — Google Form response backfill (2026-07-12)

One-time operational record. The 31 observations originally collected through the
**Civics & Elections Google Form** were imported into `survey_responses` so they
appear as results on `/survey/civics/results`, shaped exactly like organic
anonymous submissions through the native survey (which replaced that form —
migrations `00053_field_survey_intake.sql` + `00061_survey_question_builder.sql`).

## What was applied

- **Target:** OLOS-prod (`cdbgkgkjnomjnpicaxqe`) — the DB behind theupskillinglabs.org.
  (Not dev `cethihabtddiujzayaxe`; note the stale ref in `scripts/ops/CLAUDE.md`.)
- **Survey:** `field_surveys.share_slug = 'civics'`.
- **Rows:** 31, each `participant_id = NULL` (anonymous), `consent_participation = true`,
  `consent_version = 'civics-2026-07'`, `moderation_status = 'approved'`, real submission
  timestamps (America/New_York), `ip_hash`/`source_url` NULL.
- **Effect:** civics responses `1 → 32` total, `0 → 31` approved.

## Column mapping (Google Form CSV → `survey_responses`)

| CSV column | Column | Notes |
|---|---|---|
| Timestamp | `created_at` | parsed as America/New_York (`-04`, EDT) |
| Consent to Participation | `consent_participation` / `consent_version` | all consented |
| What are you observing… | `observation` | verbatim; multi-line preserved |
| What is your experience…? | `standpoint[]` | label → key map below |
| How much does this matter…? | `salience` | 1–5, NULL if blank |
| …tried to address before? | `prior_attempts` | NULL if blank |
| Can participants follow up? | `contactable` | true iff "open to being contacted" |
| Your Name | `submitter_name` | |
| Interested in mentoring? | `mentor_interest` | true iff starts with "Yes" |
| Email address | `submitter_email` | lowercased; NULL if not a valid email |
| Phone number | `submitter_phone` | |

**Standpoint map:** `I work in this field`→`work_in_field`,
`I've been personally affected by it`→`affected`, `I research or study this area`→`research`,
`I just pay close attention`→`pay_attention`, `Other`→`other`, blank→`{}`.

**Edge cases:** one email field held a name ("Suzanne Wells") → stored `NULL`; all emails
lowercased; multi-line observations preserved exactly.

## PII handling

Contact details (names/emails/phones) live in the **database only**. The source CSV and the
generated INSERT SQL contain PII and are **deliberately not committed** to this repo. This
runbook and [`import-google-form-survey-responses.py`](import-google-form-survey-responses.py)
are PII-free.

## Reproduce / re-run (idempotent)

```bash
python3 scripts/ops/import-google-form-survey-responses.py \
    --csv /path/to/Responses.csv > /tmp/seed.sql
# apply via Supabase Studio → SQL Editor for the target project
```

Each row is guarded on `(field_survey_id, created_at)` — unique per submission — so
re-running never duplicates.

## Verification performed

1. Row-by-row CSV ↔ generated-SQL check (all 31 faithful).
2. Post-apply: per-row content hash of the live prod rows matched the source exactly
   (0 missing / 0 extra); counts confirmed `32 total / 31 approved / 31 anonymous`.
