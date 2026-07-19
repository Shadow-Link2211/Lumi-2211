-- ============================================================
-- Messages: track edits
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- ============================================================
-- Reactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS reactions_message_id_idx ON reactions (message_id);

-- RLS on reactions
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reactions_select ON reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.id = reactions.message_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );

CREATE POLICY reactions_insert ON reactions FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.id = reactions.message_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );

CREATE POLICY reactions_delete ON reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Realtime: include reactions + messages (messages already added)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
END $$;
