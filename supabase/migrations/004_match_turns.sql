-- Match turns: each match has 3 turns of cooperate/betray
create table match_turns (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  turn int not null,
  team_a_decision text check (team_a_decision in ('cooperate', 'betray')),
  team_b_decision text check (team_b_decision in ('cooperate', 'betray')),
  team_a_score int not null default 0,
  team_b_score int not null default 0,
  team_a_reasoning text,
  team_b_reasoning text,
  created_at timestamptz not null default now(),
  unique(match_id, turn)
);

alter table match_turns enable row level security;
create policy "Anyone can read match turns" on match_turns for select using (true);
alter publication supabase_realtime add table match_turns;

-- Add turn number to messages so we know which turn each message belongs to
alter table messages add column if not exists turn int not null default 1;
