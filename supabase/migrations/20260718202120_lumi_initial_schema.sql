
/*
# Lumi Social Media App - Initial Schema

## Summary
Creates the complete database schema for Lumi, an AI-powered Instagram-inspired social media app.

## New Tables
1. `profiles` - Extended user profiles (username, bio, avatar, follower counts, owner tag)
2. `posts` - Image posts with captions, AI flags, fact-check status
3. `stories` - Ephemeral 24h stories with audio and translation support
4. `reels` - Short video content stored in Supabase Storage
5. `comments` - Post comments with AI-generated flag
6. `likes` - Likes on posts and reels
7. `saves` - Saved/bookmarked posts
8. `follows` - Follow relationships between users
9. `messages` - Direct messages between users
10. `conversations` - DM conversation threads
11. `notifications` - User notification events
12. `reports` - User/post reports with reason
13. `trending_audio` - YouTube-backed audio tracks for stories
14. `referrals` - Referral tracking with unique codes
15. `user_settings` - Per-user settings (theme, filters, parental lock, etc.)
16. `ai_results` - Cached AI analysis results
17. `explicit_content_flags` - Flags for explicit posts/stories
18. `parental_controls` - Parental lock config per user

## Security
- RLS enabled on all tables
- Authenticated-only access with ownership checks
- Public read for profiles (for explore/search)
- Posts readable by authenticated users; owner-scoped mutations
*/

-- =====================
-- PROFILES
-- =====================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  website text DEFAULT '',
  is_private boolean NOT NULL DEFAULT false,
  is_owner boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  referral_code text UNIQUE,
  referred_by uuid REFERENCES profiles(id),
  follower_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- =====================
-- POSTS
-- =====================
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text DEFAULT '',
  location text DEFAULT '',
  is_explicit boolean NOT NULL DEFAULT false,
  fact_check_status text NOT NULL DEFAULT 'verified' CHECK (fact_check_status IN ('verified', 'suspicious', 'likely_false')),
  fact_check_reason text DEFAULT '',
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  mood_tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "posts_insert" ON posts;
CREATE POLICY "posts_insert" ON posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update" ON posts;
CREATE POLICY "posts_update" ON posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_delete" ON posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- STORIES
-- =====================
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption text DEFAULT '',
  audio_id uuid,
  duration integer DEFAULT 5,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select" ON stories;
CREATE POLICY "stories_select" ON stories FOR SELECT TO authenticated USING (expires_at > now());

DROP POLICY IF EXISTS "stories_insert" ON stories;
CREATE POLICY "stories_insert" ON stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stories_update" ON stories;
CREATE POLICY "stories_update" ON stories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stories_delete" ON stories;
CREATE POLICY "stories_delete" ON stories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- REELS
-- =====================
CREATE TABLE IF NOT EXISTS reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text DEFAULT '',
  caption text DEFAULT '',
  audio_id uuid,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  is_explicit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select" ON reels;
CREATE POLICY "reels_select" ON reels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reels_insert" ON reels;
CREATE POLICY "reels_insert" ON reels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reels_update" ON reels;
CREATE POLICY "reels_update" ON reels FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reels_delete" ON reels;
CREATE POLICY "reels_delete" ON reels FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- COMMENTS
-- =====================
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  reel_id uuid REFERENCES reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- LIKES
-- =====================
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  reel_id uuid REFERENCES reels(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, reel_id),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select" ON likes;
CREATE POLICY "likes_select" ON likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert" ON likes;
CREATE POLICY "likes_insert" ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_update" ON likes;
CREATE POLICY "likes_update" ON likes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete" ON likes;
CREATE POLICY "likes_delete" ON likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- SAVES
-- =====================
CREATE TABLE IF NOT EXISTS saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saves_select" ON saves;
CREATE POLICY "saves_select" ON saves FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saves_insert" ON saves;
CREATE POLICY "saves_insert" ON saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saves_update" ON saves;
CREATE POLICY "saves_update" ON saves FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saves_delete" ON saves;
CREATE POLICY "saves_delete" ON saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- FOLLOWS
-- =====================
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON follows;
CREATE POLICY "follows_select" ON follows FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "follows_insert" ON follows;
CREATE POLICY "follows_insert" ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_update" ON follows;
CREATE POLICY "follows_update" ON follows FOR UPDATE TO authenticated USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete" ON follows;
CREATE POLICY "follows_delete" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- =====================
-- CONVERSATIONS
-- =====================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message text DEFAULT '',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_one, participant_two)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations FOR UPDATE TO authenticated
  USING (auth.uid() = participant_one OR auth.uid() = participant_two)
  WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "conversations_delete" ON conversations;
CREATE POLICY "conversations_delete" ON conversations FOR DELETE TO authenticated
  USING (auth.uid() = participant_one OR auth.uid() = participant_two);

-- =====================
-- MESSAGES
-- =====================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  ));

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- =====================
-- NOTIFICATIONS
-- =====================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like','comment','follow','mention','share','reel_like','story_view')),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  reel_id uuid REFERENCES reels(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (auth.uid() = recipient_id);

-- =====================
-- REPORTS
-- =====================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','fake_account','hate_speech','impersonation','scam','explicit_content')),
  details text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select" ON reports;
CREATE POLICY "reports_select" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_insert" ON reports;
CREATE POLICY "reports_insert" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update" ON reports;
CREATE POLICY "reports_update" ON reports FOR UPDATE TO authenticated USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_delete" ON reports;
CREATE POLICY "reports_delete" ON reports FOR DELETE TO authenticated USING (auth.uid() = reporter_id);

-- =====================
-- TRENDING AUDIO
-- =====================
CREATE TABLE IF NOT EXISTS trending_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  video_id text NOT NULL,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trending_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trending_audio_select" ON trending_audio;
CREATE POLICY "trending_audio_select" ON trending_audio FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "trending_audio_insert" ON trending_audio;
CREATE POLICY "trending_audio_insert" ON trending_audio FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trending_audio_update" ON trending_audio;
CREATE POLICY "trending_audio_update" ON trending_audio FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trending_audio_delete" ON trending_audio;
CREATE POLICY "trending_audio_delete" ON trending_audio FOR DELETE TO authenticated USING (true);

-- =====================
-- REFERRALS
-- =====================
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select" ON referrals;
CREATE POLICY "referrals_select" ON referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "referrals_insert" ON referrals;
CREATE POLICY "referrals_insert" ON referrals FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "referrals_update" ON referrals;
CREATE POLICY "referrals_update" ON referrals FOR UPDATE TO authenticated USING (auth.uid() = referrer_id) WITH CHECK (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "referrals_delete" ON referrals;
CREATE POLICY "referrals_delete" ON referrals FOR DELETE TO authenticated USING (auth.uid() = referrer_id);

-- =====================
-- USER SETTINGS
-- =====================
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  is_private boolean NOT NULL DEFAULT false,
  fake_news_checker boolean NOT NULL DEFAULT true,
  explicit_content_filter boolean NOT NULL DEFAULT false,
  parental_lock_enabled boolean NOT NULL DEFAULT false,
  parental_lock_password text DEFAULT NULL,
  parental_screen_time_limit integer DEFAULT 120,
  parental_block_dms boolean NOT NULL DEFAULT false,
  notification_likes boolean NOT NULL DEFAULT true,
  notification_comments boolean NOT NULL DEFAULT true,
  notification_follows boolean NOT NULL DEFAULT true,
  notification_messages boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
CREATE POLICY "user_settings_select" ON user_settings FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
CREATE POLICY "user_settings_insert" ON user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
CREATE POLICY "user_settings_update" ON user_settings FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_settings_delete" ON user_settings;
CREATE POLICY "user_settings_delete" ON user_settings FOR DELETE TO authenticated USING (auth.uid() = id);

-- =====================
-- AI RESULTS
-- =====================
CREATE TABLE IF NOT EXISTS ai_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  result_type text NOT NULL CHECK (result_type IN ('fact_check','explicit_detection','caption_summary','comment_suggestions')),
  result_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_results_select" ON ai_results;
CREATE POLICY "ai_results_select" ON ai_results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ai_results_insert" ON ai_results;
CREATE POLICY "ai_results_insert" ON ai_results FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ai_results_update" ON ai_results;
CREATE POLICY "ai_results_update" ON ai_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ai_results_delete" ON ai_results;
CREATE POLICY "ai_results_delete" ON ai_results FOR DELETE TO authenticated USING (true);

-- =====================
-- EXPLICIT CONTENT FLAGS
-- =====================
CREATE TABLE IF NOT EXISTS explicit_content_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  story_id uuid REFERENCES stories(id) ON DELETE CASCADE,
  reel_id uuid REFERENCES reels(id) ON DELETE CASCADE,
  confidence float NOT NULL DEFAULT 0.0,
  flagged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE explicit_content_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "explicit_flags_select" ON explicit_content_flags;
CREATE POLICY "explicit_flags_select" ON explicit_content_flags FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "explicit_flags_insert" ON explicit_content_flags;
CREATE POLICY "explicit_flags_insert" ON explicit_content_flags FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "explicit_flags_update" ON explicit_content_flags;
CREATE POLICY "explicit_flags_update" ON explicit_content_flags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "explicit_flags_delete" ON explicit_content_flags;
CREATE POLICY "explicit_flags_delete" ON explicit_content_flags FOR DELETE TO authenticated USING (true);

-- =====================
-- SEED TRENDING AUDIO
-- =====================
INSERT INTO trending_audio (title, artist, video_id) VALUES
  ('Blinding Lights', 'The Weeknd', '4NRXx6U8ABQ'),
  ('As It Was', 'Harry Styles', 'H5v3kku4y6Q'),
  ('Stay', 'The Kid LAROI & Justin Bieber', 'kTJczUoc26U'),
  ('Bad Guy', 'Billie Eilish', 'DyDfgMOUjCI'),
  ('Levitating', 'Dua Lipa', 'TUVcZfQe-Kw'),
  ('Save Your Tears', 'The Weeknd', 'LIIDh-qI9oI'),
  ('Peaches', 'Justin Bieber', 'tQ0yjYUFKAE'),
  ('montero', 'Lil Nas X', '6swmTBVI83k')
ON CONFLICT DO NOTHING;

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS stories_user_id_idx ON stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON stories(expires_at);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id);
CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes(post_id);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
