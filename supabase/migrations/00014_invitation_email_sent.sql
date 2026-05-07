-- Track when the magic link email was last sent for an invitation.
-- NULL means the email has never been sent via Resend (e.g. link was only copied manually).
ALTER TABLE invitations ADD COLUMN email_sent_at TIMESTAMPTZ;
