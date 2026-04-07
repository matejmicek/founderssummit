-- Migration 011: Human decision mode
-- Core change: teams make cooperate/betray decisions manually instead of AI

-- Track human decisions per turn
CREATE TABLE team_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  turn int NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  decision text CHECK (decision IN ('cooperate', 'betray')) NOT NULL,
  noise_flipped boolean DEFAULT false,
  effective_decision text CHECK (effective_decision IN ('cooperate', 'betray')) NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE (match_id, turn, team_id)
);

-- Add current turn tracking to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_turn int DEFAULT 1;

-- Add decision deadline for timer
ALTER TABLE matches ADD COLUMN IF NOT EXISTS decision_deadline timestamptz;

-- Add noise tracking to match_turns
ALTER TABLE match_turns ADD COLUMN IF NOT EXISTS noise_flipped_a boolean DEFAULT false;
ALTER TABLE match_turns ADD COLUMN IF NOT EXISTS noise_flipped_b boolean DEFAULT false;

-- Add round rules config to seasons (escalating mechanics per round)
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS round_rules jsonb DEFAULT '{}';

-- Add archetype to playbooks for quick-start
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS archetype text;

-- Add negotiation_goal to playbooks (replaces cooperate/betray strategy in human mode)
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS negotiation_goal text;

-- Enable Realtime on team_decisions for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE team_decisions;

-- RLS: public read
ALTER TABLE team_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read team_decisions" ON team_decisions FOR SELECT USING (true);

-- Index for fast lookups
CREATE INDEX idx_team_decisions_match_turn ON team_decisions(match_id, turn);
CREATE INDEX idx_matches_current_turn ON matches(current_turn) WHERE status IN ('talking', 'deciding');
