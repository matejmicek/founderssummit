-- Add join codes to teams so teammates can join via code/QR
ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Backfill existing teams with random 5-char codes
UPDATE teams SET join_code = upper(substr(md5(random()::text), 1, 5))
WHERE join_code IS NULL;

ALTER TABLE teams ALTER COLUMN join_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
