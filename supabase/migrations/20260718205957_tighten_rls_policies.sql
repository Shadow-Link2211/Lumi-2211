
/*
# Tighten RLS policies that allowed unrestricted access

## Summary
Several tables had RLS policies with `USING (true)` or `WITH CHECK (true)`,
which effectively bypassed row-level security for authenticated users. This
migration replaces those permissive policies with proper ownership checks.

## Tables affected
1. `ai_results` — INSERT/UPDATE/DELETE now require the referenced post to be
   owned by the authenticated user.
2. `explicit_content_flags` — INSERT/UPDATE/DELETE now require the referenced
   post/story/reel to be owned by the authenticated user.
3. `notifications` — INSERT now requires the actor to be the authenticated user
   (or NULL for system-generated notifications).
4. `referrals` — INSERT now requires the referrer or referred user to be the
   authenticated user.
5. `trending_audio` — INSERT/UPDATE/DELETE now restricted to the Owner account
   only (curated reference data).

## Security changes
- Dropped and recreated permissive policies with ownership predicates.
- No SELECT policies changed (public read remains for shared reference data).
*/

-- =====================
-- ai_results
-- =====================
DROP POLICY IF EXISTS "ai_results_insert" ON ai_results;
CREATE POLICY "ai_results_insert" ON ai_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = ai_results.post_id
      AND posts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_results_update" ON ai_results;
CREATE POLICY "ai_results_update" ON ai_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = ai_results.post_id
      AND posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = ai_results.post_id
      AND posts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_results_delete" ON ai_results;
CREATE POLICY "ai_results_delete" ON ai_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = ai_results.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- =====================
-- explicit_content_flags
-- =====================
DROP POLICY IF EXISTS "explicit_flags_insert" ON explicit_content_flags;
CREATE POLICY "explicit_flags_insert" ON explicit_content_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM posts WHERE posts.id = explicit_content_flags.post_id AND posts.user_id = auth.uid()
    ))
    OR (story_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM stories WHERE stories.id = explicit_content_flags.story_id AND stories.user_id = auth.uid()
    ))
    OR (reel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM reels WHERE reels.id = explicit_content_flags.reel_id AND reels.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "explicit_flags_update" ON explicit_content_flags;
CREATE POLICY "explicit_flags_update" ON explicit_content_flags FOR UPDATE
  TO authenticated
  USING (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM posts WHERE posts.id = explicit_content_flags.post_id AND posts.user_id = auth.uid()
    ))
    OR (story_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM stories WHERE stories.id = explicit_content_flags.story_id AND stories.user_id = auth.uid()
    ))
    OR (reel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM reels WHERE reels.id = explicit_content_flags.reel_id AND reels.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM posts WHERE posts.id = explicit_content_flags.post_id AND posts.user_id = auth.uid()
    ))
    OR (story_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM stories WHERE stories.id = explicit_content_flags.story_id AND stories.user_id = auth.uid()
    ))
    OR (reel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM reels WHERE reels.id = explicit_content_flags.reel_id AND reels.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "explicit_flags_delete" ON explicit_content_flags;
CREATE POLICY "explicit_flags_delete" ON explicit_content_flags FOR DELETE
  TO authenticated
  USING (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM posts WHERE posts.id = explicit_content_flags.post_id AND posts.user_id = auth.uid()
    ))
    OR (story_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM stories WHERE stories.id = explicit_content_flags.story_id AND stories.user_id = auth.uid()
    ))
    OR (reel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM reels WHERE reels.id = explicit_content_flags.reel_id AND reels.user_id = auth.uid()
    ))
  );

-- =====================
-- notifications
-- =====================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- =====================
-- referrals
-- =====================
DROP POLICY IF EXISTS "referrals_insert" ON referrals;
CREATE POLICY "referrals_insert" ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (referrer_id = auth.uid() OR referred_id = auth.uid());

-- =====================
-- trending_audio (owner-only mutations; curated reference data)
-- =====================
DROP POLICY IF EXISTS "trending_audio_insert" ON trending_audio;
CREATE POLICY "trending_audio_insert" ON trending_audio FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_owner = true
    )
  );

DROP POLICY IF EXISTS "trending_audio_update" ON trending_audio;
CREATE POLICY "trending_audio_update" ON trending_audio FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_owner = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_owner = true
    )
  );

DROP POLICY IF EXISTS "trending_audio_delete" ON trending_audio;
CREATE POLICY "trending_audio_delete" ON trending_audio FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_owner = true
    )
  );
