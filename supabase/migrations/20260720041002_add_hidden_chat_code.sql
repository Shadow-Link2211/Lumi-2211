-- Add hidden_code column to hidden_conversations for the 4-letter reveal code
ALTER TABLE hidden_conversations ADD COLUMN IF NOT EXISTS hidden_code VARCHAR(4);

-- Add comment
COMMENT ON COLUMN hidden_conversations.hidden_code IS '4-letter code required to reveal this hidden chat in the search bar';
