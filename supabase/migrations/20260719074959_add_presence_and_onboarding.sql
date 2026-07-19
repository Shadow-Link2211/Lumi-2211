-- Add presence tracking and onboarding flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- Index for quick online-status queries
CREATE INDEX IF NOT EXISTS profiles_is_online_idx ON profiles (is_online) WHERE is_online = true;
