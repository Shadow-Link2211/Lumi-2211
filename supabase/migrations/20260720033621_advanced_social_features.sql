/*
# Advanced Social Features Migration

## Summary
Adds saved reels support, search history, screen time tracking, group chats,
ephemeral messages, "not interested" feedback, and a recommendation function.
Also adds save count triggers for posts and reels.

## New Tables
1. search_history - recent search queries per user
2. screen_time_stats - daily app usage stats per section
3. chat_members - group chat membership (extends conversations for groups)
4. ephemeral_messages - self-destructing messages after all recipients view them
5. not_interested - posts/reels a user dismissed from their feed
6. shared_posts - posts/reels shared via DM (embedded preview)

## Modified Tables
1. saves - add reel_id column (nullable) so reels can be saved too
2. conversations - add is_group, group_name, group_icon_url, group_owner_id columns
3. messages - add shared_post_id, shared_reel_id, is_ephemeral, expires_at columns
4. posts - add save_count trigger
5. reels - add save_count trigger, add save_count column
*/

-- ============================================================
-- 1. saves: add reel_id
-- ============================================================
ALTER TABLE saves ADD COLUMN IF NOT EXISTS reel_id uuid REFERENCES reels(id) ON DELETE CASCADE;

-- ============================================================
-- 2. reels: add save_count column
-- ============================================================
ALTER TABLE reels ADD COLUMN IF NOT EXISTS save_count integer DEFAULT 0;

-- ============================================================
-- 3. Save count triggers (posts + reels)
-- ============================================================
CREATE OR REPLACE FUNCTION update_post_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET save_count = (SELECT count(*) FROM saves WHERE saves.post_id = NEW.post_id) WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET save_count = (SELECT count(*) FROM saves WHERE saves.post_id = OLD.post_id) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saves_post_insert ON saves;
DROP TRIGGER IF EXISTS saves_post_delete ON saves;
CREATE TRIGGER saves_post_insert AFTER INSERT ON saves
  FOR EACH ROW WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION update_post_save_count();
CREATE TRIGGER saves_post_delete AFTER DELETE ON saves
  FOR EACH ROW WHEN (OLD.post_id IS NOT NULL)
  EXECUTE FUNCTION update_post_save_count();

CREATE OR REPLACE FUNCTION update_reel_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE reels SET save_count = (SELECT count(*) FROM saves WHERE saves.reel_id = NEW.reel_id) WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE reels SET save_count = (SELECT count(*) FROM saves WHERE saves.reel_id = OLD.reel_id) WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saves_reel_insert ON saves;
DROP TRIGGER IF EXISTS saves_reel_delete ON saves;
CREATE TRIGGER saves_reel_insert AFTER INSERT ON saves
  FOR EACH ROW WHEN (NEW.reel_id IS NOT NULL)
  EXECUTE FUNCTION update_reel_save_count();
CREATE TRIGGER saves_reel_delete AFTER DELETE ON saves
  FOR EACH ROW WHEN (OLD.reel_id IS NOT NULL)
  EXECUTE FUNCTION update_reel_save_count();

-- ============================================================
-- 4. search_history
-- ============================================================
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query text NOT NULL,
  searched_at timestamptz DEFAULT now()
);
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_search_history" ON search_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_search_history" ON search_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_search_history" ON search_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. screen_time_stats
-- ============================================================
CREATE TABLE IF NOT EXISTS screen_time_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stat_date date NOT NULL DEFAULT CURRENT_DATE,
  section text NOT NULL,
  seconds_spent integer DEFAULT 0,
  app_opens integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, stat_date, section)
);
ALTER TABLE screen_time_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_screen_time" ON screen_time_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_screen_time" ON screen_time_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_screen_time" ON screen_time_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_screen_time" ON screen_time_stats FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 6. conversations: group chat columns
-- ============================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_name text DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_icon_url text DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 7. chat_members (for group chats)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false,
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_chat_members" ON chat_members FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.conversation_id = chat_members.conversation_id AND cm.user_id = auth.uid()));
CREATE POLICY "insert_chat_members" ON chat_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.group_owner_id = auth.uid()));
CREATE POLICY "delete_chat_members" ON chat_members FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.group_owner_id = auth.uid()));

-- ============================================================
-- 8. messages: shared posts + ephemeral support
-- ============================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shared_post_id uuid REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shared_reel_id uuid REFERENCES reels(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_ephemeral boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS viewed_by uuid[] DEFAULT '{}';

-- ============================================================
-- 9. not_interested
-- ============================================================
CREATE TABLE IF NOT EXISTS not_interested (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  reel_id uuid REFERENCES reels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CHECK (post_id IS NOT NULL OR reel_id IS NOT NULL)
);
ALTER TABLE not_interested ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_not_interested" ON not_interested FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_not_interested" ON not_interested FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_not_interested" ON not_interested FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 10. user_settings: screen time goal
-- ============================================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS screen_time_goal_minutes integer DEFAULT 0;

-- ============================================================
-- 11. Realtime: add new tables to publication
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['saves','search_history','screen_time_stats','chat_members','not_interested'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE t; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 12. Backfill save counts
-- ============================================================
UPDATE posts p SET save_count = (SELECT count(*) FROM saves s WHERE s.post_id = p.id);
UPDATE reels r SET save_count = (SELECT count(*) FROM saves s WHERE s.reel_id = r.id);

-- ============================================================
-- 13. Recommendation function
-- Returns post IDs ranked by a composite score:
--   - recency, likes, comments, saves
--   - from followed accounts (boost)
--   - excludes not_interested and own posts
--   - trending boost for high engagement
-- ============================================================
CREATE OR REPLACE FUNCTION get_recommended_posts(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (id uuid, score float) AS $$
BEGIN
  RETURN QUERY
  WITH followed AS (
    SELECT following_id FROM follows WHERE follower_id = p_user_id
  ),
  not_interested_posts AS (
    SELECT post_id FROM not_interested WHERE user_id = p_user_id AND post_id IS NOT NULL
  )
  SELECT p.id,
    (
      -- Recency: newer posts score higher (up to 100 points over 7 days)
      GREATEST(0, 100 - EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600 * 0.6)::float +
      -- Engagement
      (p.like_count * 2)::float +
      (p.comment_count * 3)::float +
      (p.save_count * 4)::float +
      -- Followed boost
      CASE WHEN p.user_id IN (SELECT following_id FROM followed) THEN 50 ELSE 0 END +
      -- Trending boost (high engagement relative to age)
      CASE WHEN p.like_count > 10 AND p.created_at > now() - interval '3 days' THEN 30 ELSE 0 END
    ) AS score
  FROM posts p
  WHERE p.user_id != p_user_id
    AND p.id NOT IN (SELECT post_id FROM not_interested_posts)
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
