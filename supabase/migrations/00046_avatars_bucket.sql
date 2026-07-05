-- 00046_avatars_bucket.sql
--
-- Member profile photos. A public Storage bucket for avatars, written only by
-- the server (the /api/participants/[id]/avatar route uses the service role, so
-- validation + authz happen in app code and storage RLS is bypassed on write).
-- Public read is what lets <img src> load the photo in the directory and on
-- profiles; participants.profile_image_url holds the public URL.
--
-- Idempotent. The bucket enforces a 2 MB cap and image-only mime types as a
-- backstop; the client resizes to ~512px before upload, so real uploads are
-- far smaller.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage.objects RLS policies: reads are served by the public bucket
-- endpoint (RLS-exempt), and writes/deletes go through the server's service
-- role. If direct client uploads are ever wanted, add owner-scoped policies
-- keyed on (storage.foldername(name))[1] = the participant id.
