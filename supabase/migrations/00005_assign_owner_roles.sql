-- Assign owner role to bootstrap owner emails if they already have participant records.
INSERT INTO user_roles (participant_id, role, granted_by, granted_at)
SELECT p.id, 'owner', NULL, NOW()
FROM participants p
WHERE LOWER(p.email) IN (
  'hq@theupskillinglabs.org',
  'brendan@withlevy.com'
)
ON CONFLICT (participant_id, role) DO NOTHING;
