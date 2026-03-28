-- Team-specific highlights: nullable team_id means "for this team"
-- NULL team_id = global highlight (shown on projector)
-- Non-null team_id = personalized highlight for that team
ALTER TABLE highlights ADD COLUMN team_id uuid REFERENCES teams(id);

CREATE INDEX idx_highlights_team ON highlights(team_id) WHERE team_id IS NOT NULL;
