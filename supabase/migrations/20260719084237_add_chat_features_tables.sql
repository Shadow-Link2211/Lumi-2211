-- ============================================================
-- Reactions: full replica identity so DELETE events carry all columns
-- ============================================================
ALTER TABLE reactions REPLICA IDENTITY FULL;

-- ============================================================
-- Messages: media attachment columns
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,           -- 'image' | 'video'
  ADD COLUMN IF NOT EXISTS media_thumbnail_url text;

-- ============================================================
-- hidden_messages: per-user "delete for me" of individual messages
-- ============================================================
CREATE TABLE IF NOT EXISTS hidden_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
ALTER TABLE hidden_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY hidden_messages_select ON hidden_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY hidden_messages_insert ON hidden_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY hidden_messages_delete ON hidden_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- hidden_conversations: per-user "delete chat for me"
-- ============================================================
CREATE TABLE IF NOT EXISTS hidden_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id)
);
ALTER TABLE hidden_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY hidden_conversations_select ON hidden_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY hidden_conversations_insert ON hidden_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY hidden_conversations_delete ON hidden_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- muted_chats: per-user mute
-- ============================================================
CREATE TABLE IF NOT EXISTS muted_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  muted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id)
);
ALTER TABLE muted_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY muted_chats_select ON muted_chats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY muted_chats_insert ON muted_chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY muted_chats_delete ON muted_chats FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- blocked_users: per-user block
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_user_id)
);
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocked_users_select ON blocked_users FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY blocked_users_insert ON blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY blocked_users_delete ON blocked_users FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- contact_nicknames: per-user private nickname
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_nicknames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);
ALTER TABLE contact_nicknames ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_nicknames_select ON contact_nicknames FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY contact_nicknames_insert ON contact_nicknames FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY contact_nicknames_update ON contact_nicknames FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY contact_nicknames_delete ON contact_nicknames FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for chat media
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can CRUD their own files
CREATE POLICY chat_media_select ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'chat-media');
CREATE POLICY chat_media_insert ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'chat-media' AND auth.uid() = owner);
CREATE POLICY chat_media_update ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'chat-media' AND auth.uid() = owner);
CREATE POLICY chat_media_delete ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'chat-media' AND auth.uid() = owner);

-- ============================================================
-- Realtime: include new tables
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
END $$;
