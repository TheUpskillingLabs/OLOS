-- seed-sample-spotlights.sql
-- DEV / DEMO ONLY — NOT a migration; do NOT run against production.
-- Populates the public /stories page + landing spotlights row with the
-- two real headshot spotlights (Hector & Suzie) so the preview looks
-- lived-in. Production keeps the empty-until-real posture (migration 00036);
-- real spotlights arrive via the /admin/stories submission→publish flow.
-- Idempotent (ON CONFLICT (slug) DO NOTHING).

INSERT INTO spotlights (slug, name, role, tag, tag_label, quote, story, grad, image_url, status, sort_order, published_at)
VALUES
  ($tul$hector$tul$, $tul$Hector Perla$tul$, $tul$Inaugural AI Cohort$tul$, $tul$builder$tul$, $tul$Builder$tul$, $tul$The program gave me purpose again—connecting me with mission-driven public servants to tackle real problems. AI as an empowerment tool for people-first civic design.$tul$, $tul$["Hector came to the Labs mid-career, carrying an ADHD diagnosis he’d only recently named and a feeling that his systems-thinking never fit a job description. The Problem Sprint changed the frame: mapping benefits-navigation dead-ends in the Triangulator, his pattern-spotting was suddenly the team’s sharpest tool.","By Showcase his pod had shipped a plain-language eligibility guide piloted at three library branches. “I stopped apologizing for how my brain works,” he says. “The Labs gave it a job.”"]$tul$::jsonb, $tul$m-teal$tul$, $tul$/assets/spotlights/Hector8084.jpg$tul$, $tul$published$tul$, 0, now()),
  ($tul$suzie$tul$, $tul$Suzie Zhang$tul$, $tul$Inaugural AI Cohort$tul$, $tul$career_changer$tul$, $tul$Career changer$tul$, $tul$I left realizing my gap is exactly where my strength lies—translating between tools, teams, and user needs. AI is about community, trust, and the human side of technology.$tul$, $tul$["Suzie spent eight years coaching financial literacy and assumed “learning AI” meant becoming an engineer. Her Practice Journal told a different story: week after week, the entries that mattered were about translation — turning what the tools could do into what her community could trust.","She now runs AI-literacy workshops for three community organizations, built on the playbook her project team returned to the commons."]$tul$::jsonb, $tul$m-forest$tul$, $tul$/assets/spotlights/Suzie8554.jpg$tul$, $tul$published$tul$, 1, now())
ON CONFLICT (slug) DO NOTHING;

-- Backfill the two headshots onto rows that already exist on dev (the INSERT
-- above is ON CONFLICT DO NOTHING, so it won't touch pre-seeded rows). Keeps
-- this script self-healing + idempotent.
UPDATE spotlights SET image_url = $tul$/assets/spotlights/Hector8084.jpg$tul$ WHERE slug = $tul$hector$tul$;
UPDATE spotlights SET image_url = $tul$/assets/spotlights/Suzie8554.jpg$tul$ WHERE slug = $tul$suzie$tul$;
