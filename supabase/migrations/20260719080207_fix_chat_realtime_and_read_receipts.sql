-- ============================================================
-- Fix 1: Enable realtime for messaging tables
-- ============================================================
-- The supabase_realtime publication was empty, so no INSERT/UPDATE
-- events ever fired. Add the tables that the chat UI depends on.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;

-- ============================================================
-- Fix 2: Allow recipients to mark messages as read
-- ============================================================
-- The old messages_update policy only allowed auth.uid() = sender_id,
-- which silently blocked recipients from flipping is_read to true.
-- Drop and recreate so that any participant in the conversation can
-- update is_read (the only column a recipient needs to touch).
DROP POLICY IF EXISTS messages_update ON messages;

CREATE POLICY messages_update ON messages FOR UPDATE
  TO authenticated
  USING (
    -- sender can update their own messages,
    -- OR the current user is a participant in the message's conversation
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );
