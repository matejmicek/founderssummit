-- Store full turn-by-turn decisions in encounter history
-- Previously only the final turn's decision was stored, losing the 3-turn arc
ALTER TABLE encounter_history
  ADD COLUMN IF NOT EXISTS turn_decisions jsonb;
