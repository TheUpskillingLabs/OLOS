-- PRD: docs/PRD-moderator-dashboard.md §7.1, §7.2, §7.10.3, §9
-- Subdoc: docs/poderator-dashboard/CLAUDE.md (cycle_config extensions)
--
-- Cycle-scoped configuration backing the poderator dashboard:
--   - pulse_band_warning_min / pulse_band_critical_min:
--       pod-health indicator absolute-headcount band thresholds (§7.1).
--       Defaults match the mockup labeling ("Healthy: 0 · Warning: 1-2 · Critical: 3+").
--   - at_risk_consecutive_misses:
--       miss threshold for the at-risk nudge (§7.2). Default 2 per PRD §10.
--   - pulse_agg_default_weeks:
--       default range for §7.9 aggregations and §7.10.3 comment bundles.
--   - ai_summary_prompt:
--       canonical prompt copied to clipboard by §7.10.3. One prompt for
--       both All pods and per-pod scopes; per-cycle override possible.
--       Seeded with a placeholder; program team refines later.
--
-- Existing cycle_config RLS (00002:48-50) covers reads/writes — no new
-- policies needed.

ALTER TABLE cycle_config
  ADD COLUMN pulse_band_warning_min       INT NOT NULL DEFAULT 1,
  ADD COLUMN pulse_band_critical_min      INT NOT NULL DEFAULT 3,
  ADD COLUMN at_risk_consecutive_misses   INT NOT NULL DEFAULT 2,
  ADD COLUMN pulse_agg_default_weeks      INT NOT NULL DEFAULT 4,
  ADD COLUMN ai_summary_prompt            TEXT;

-- Seed the AI summary prompt with a placeholder. Program team owns the
-- final copy; see PRD §7.10.3. The exact wording will iterate after
-- launch based on poderator feedback and observed quality of summaries.
UPDATE cycle_config
SET ai_summary_prompt = $$You are helping a community pod-leader (a "poderator") understand what's happening in their pods. Below are pulse-check responses from members of the pods I'm assigned to. Each response is tagged with the member's initials, their pod, and the week.

Please:
- Identify recurring themes across the responses (what members are stuck on, what help they're asking for, what's going well).
- Flag members or topics I should pay attention to this week.
- Cite the specific responses you draw conclusions from.
- Be descriptive, not judgmental ("Confusion about proposal scope," not "Members seem lost").

[Program team to refine.]
$$
WHERE ai_summary_prompt IS NULL;

-- DOWN (manual rollback — forward-only repo policy):
-- ALTER TABLE cycle_config
--   DROP COLUMN IF EXISTS ai_summary_prompt,
--   DROP COLUMN IF EXISTS pulse_agg_default_weeks,
--   DROP COLUMN IF EXISTS at_risk_consecutive_misses,
--   DROP COLUMN IF EXISTS pulse_band_critical_min,
--   DROP COLUMN IF EXISTS pulse_band_warning_min;
