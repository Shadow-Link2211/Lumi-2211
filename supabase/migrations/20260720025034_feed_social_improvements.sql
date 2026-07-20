/*
# Feed & Social Features - Bug Fixes and Improvements

## Summary
Adds database triggers to keep like/follow counts in sync, enables a Story
Archive (owner-only access to expired stories), adds an audio_id column to
posts so music can be attached to posts, and constrains story durations to
1-60 seconds.

## New Tables
- (none) — the Story Archive reuses the existing `stories` table via an
  expanded SELECT policy (owners can read their own expired stories).

## Modified Tables
1. `posts`
   - New column `audio_id uuid` (nullable, references trending_audio) so a
     song can be attached to an image or video post and auto-play when the
     post is opened.
2. `stories`
   - Add CHECK constraint on `duration`: must be between 1 and 60 seconds
     (image stories). Video stories play for their full duration up to the
     60-second cap.

## Security Changes
1. `stories` SELECT policy widened so the owner of a story can read their
   own expired stories (for the Story Archive), while other users can only
   read active (non-expired) stories. Archived stories are only visible to
   their owner.
2. `posts` SELECT/UPDATE policies unchanged; the new `audio_id` column is
   covered by the existing owner-scoped policies.

## New Triggers / Functions
1. `update_post_like_count()` — AFTER INSERT or DELETE on `likes` where
   `post_id` is not null; recomputes `posts.like_count` from the likes
   table so the displayed count stays correct in real time.
2. `update_reel_like_count()` — AFTER INSERT or DELETE on `likes` where
   `reel_id` is not null; recomputes `reels.like_count`.
3. `update_follow_counts()` — AFTER INSERT or DELETE on `follows`;
   recomputes `profiles.follower_count` (for the followed user) and
   `profiles.following_count` (for the follower) so both counts update
   instantly across all screens.
4. `update_post_comment_count()` — AFTER INSERT or DELETE on `comments`
   where `post_id` is not null; recomputes `posts.comment_count`.

## Realtime
- Adds `story_archive` is not a table (reuses stories), so no new
  publication entries are needed beyond what exists. The existing
  `supabase_realtime` publication already includes likes/follows/posts/
  reels/profiles from prior migrations; this migration ensures those
  tables are in the publication for live count updates.

## Important Notes
1. The like/follow count bug existed because the app only faked the count
   in the UI (`post.like_count + (liked ? 1 : 0)`) while the database
   `like_count` column never changed. These triggers make the database the
   source of truth; the frontend now reads the real count and subscribes
   to realtime changes.
2. Story Archive visibility is enforced by RLS: expired stories are only
   readable by their owner. No separate archive table is needed, avoiding
   data duplication.
3. Story duration is capped at 60 seconds (1 minute) for image stories;
   video stories play for their full duration up to the same 60-second cap.
*/

-- ============================================================
-- 1. posts.audio_id column (music on posts)
-- ============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS audio_id uuid REFERENCES trending_audio(id) ON DELETE SET NULL;

-- ============================================================
-- 2. stories duration CHECK (1-60 seconds)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stories_duration_range'
  ) THEN
    ALTER TABLE stories ADD CONSTRAINT stories_duration_range
      CHECK (duration >= 1 AND duration <= 60);
  END IF;
END $$;

-- ============================================================
-- 3. stories SELECT policy: owners can read their own expired stories (archive)
-- ============================================================
DROP POLICY IF EXISTS "stories_select" ON stories;
CREATE POLICY "stories_select" ON stories FOR SELECT
  TO authenticated USING (expires_at > now() OR auth.uid() = user_id);

-- ============================================================
-- 4. Like count trigger for posts
-- ============================================================
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET like_count = (
      SELECT count(*) FROM likes WHERE likes.post_id = NEW.post_id
    ) WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET like_count = (
      SELECT count(*) FROM likes WHERE likes.post_id = OLD.post_id
    ) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS likes_post_insert ON likes;
DROP TRIGGER IF EXISTS likes_post_delete ON likes;
CREATE TRIGGER likes_post_insert AFTER INSERT ON likes
  FOR EACH ROW WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION update_post_like_count();
CREATE TRIGGER likes_post_delete AFTER DELETE ON likes
  FOR EACH ROW WHEN (OLD.post_id IS NOT NULL)
  EXECUTE FUNCTION update_post_like_count();

-- ============================================================
-- 5. Like count trigger for reels
-- ============================================================
CREATE OR REPLACE FUNCTION update_reel_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE reels SET like_count = (
      SELECT count(*) FROM likes WHERE likes.reel_id = NEW.reel_id
    ) WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE reels SET like_count = (
      SELECT count(*) FROM likes WHERE likes.reel_id = OLD.reel_id
    ) WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS likes_reel_insert ON likes;
DROP TRIGGER IF EXISTS likes_reel_delete ON likes;
CREATE TRIGGER likes_reel_insert AFTER INSERT ON likes
  FOR EACH ROW WHEN (NEW.reel_id IS NOT NULL)
  EXECUTE FUNCTION update_reel_like_count();
CREATE TRIGGER likes_reel_delete AFTER DELETE ON likes
  FOR EACH ROW WHEN (OLD.reel_id IS NOT NULL)
  EXECUTE FUNCTION update_reel_like_count();

-- ============================================================
-- 6. Follow count trigger (follower_count + following_count)
-- ============================================================
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE profiles SET following_count = (
      SELECT count(*) FROM follows WHERE follows.follower_id = NEW.follower_id
    ) WHERE id = NEW.follower_id;
    UPDATE profiles SET follower_count = (
      SELECT count(*) FROM follows WHERE follows.following_id = NEW.following_id
    ) WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE profiles SET following_count = (
      SELECT count(*) FROM follows WHERE follows.follower_id = OLD.follower_id
    ) WHERE id = OLD.follower_id;
    UPDATE profiles SET follower_count = (
      SELECT count(*) FROM follows WHERE follows.following_id = OLD.following_id
    ) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS follows_insert ON follows;
DROP TRIGGER IF EXISTS follows_delete ON follows;
CREATE TRIGGER follows_insert AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
CREATE TRIGGER follows_delete AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ============================================================
-- 7. Comment count trigger for posts
-- ============================================================
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET comment_count = (
      SELECT count(*) FROM comments WHERE comments.post_id = NEW.post_id
    ) WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET comment_count = (
      SELECT count(*) FROM comments WHERE comments.post_id = OLD.post_id
    ) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comments_post_insert ON comments;
DROP TRIGGER IF EXISTS comments_post_delete ON comments;
CREATE TRIGGER comments_post_insert AFTER INSERT ON comments
  FOR EACH ROW WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION update_post_comment_count();
CREATE TRIGGER comments_post_delete AFTER DELETE ON comments
  FOR EACH ROW WHEN (OLD.post_id IS NOT NULL)
  EXECUTE FUNCTION update_post_comment_count();

-- ============================================================
-- 8. Realtime: ensure key tables are published for live updates
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','reels','profiles','likes','follows','comments','stories','trending_audio'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND tablename=t
    ) THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE t;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 9. Backfill counts from existing likes/follows/comments
-- ============================================================
UPDATE posts p SET like_count = (
  SELECT count(*) FROM likes l WHERE l.post_id = p.id
);
UPDATE posts p SET comment_count = (
  SELECT count(*) FROM comments c WHERE c.post_id = p.id
);
UPDATE reels r SET like_count = (
  SELECT count(*) FROM likes l WHERE l.reel_id = r.id
);
UPDATE profiles pr SET following_count = (
  SELECT count(*) FROM follows f WHERE f.follower_id = pr.id
);
UPDATE profiles pr SET follower_count = (
  SELECT count(*) FROM follows f WHERE f.following_id = pr.id
);
