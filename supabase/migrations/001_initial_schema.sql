-- Agent Arena: Iterated Prisoner's Dilemma with Talking LLM Agents
-- Database schema

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6366f1',
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- Seasons
create table seasons (
  id serial primary key,
  number int not null unique,
  status text not null default 'pending' check (status in ('pending', 'building', 'running', 'tweaking', 'completed')),
  current_round int not null default 0,
  total_rounds int not null default 5,
  points_multiplier int not null default 1,
  created_at timestamptz not null default now()
);

-- Playbooks (one per team per season)
create table playbooks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  season_id int not null references seasons(id) on delete cascade,
  personality text not null default '' check (char_length(personality) <= 200),
  strategy text not null default '' check (char_length(strategy) <= 300),
  secret_weapon text not null default '' check (char_length(secret_weapon) <= 100),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, season_id)
);

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  season_id int not null references seasons(id) on delete cascade,
  round int not null,
  team_a_id uuid not null references teams(id),
  team_b_id uuid not null references teams(id),
  team_a_decision text check (team_a_decision in ('cooperate', 'betray')),
  team_b_decision text check (team_b_decision in ('cooperate', 'betray')),
  team_a_score int,
  team_b_score int,
  team_a_reasoning text,
  team_b_reasoning text,
  status text not null default 'pending' check (status in ('pending', 'talking', 'deciding', 'completed', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

-- Messages (negotiation transcript)
create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id),
  content text not null,
  sequence int not null,
  created_at timestamptz not null default now()
);
create index idx_messages_match on messages(match_id, sequence);

-- Encounter history (per-team memory of each opponent)
create table encounter_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  opponent_id uuid not null references teams(id),
  match_id uuid not null references matches(id) on delete cascade,
  season_id int not null references seasons(id),
  round int not null,
  my_decision text not null check (my_decision in ('cooperate', 'betray')),
  their_decision text not null check (their_decision in ('cooperate', 'betray')),
  my_score int not null,
  their_score int not null,
  summary text,
  created_at timestamptz not null default now()
);
create index idx_encounter_history on encounter_history(team_id, opponent_id);

-- Leaderboard (denormalized, refreshed after each round)
create table leaderboard (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  season_id int not null references seasons(id),
  total_score int not null default 0,
  matches_played int not null default 0,
  cooperate_count int not null default 0,
  betray_count int not null default 0,
  rank int not null default 0,
  previous_rank int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, season_id)
);

-- Enable Realtime on key tables
alter publication supabase_realtime add table leaderboard;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table messages;

-- RLS policies (permissive for game context)
alter table teams enable row level security;
alter table seasons enable row level security;
alter table playbooks enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table encounter_history enable row level security;
alter table leaderboard enable row level security;

-- Everyone can read most tables
create policy "Public read teams" on teams for select using (true);
create policy "Public read seasons" on seasons for select using (true);
create policy "Public read matches" on matches for select using (true);
create policy "Public read messages" on messages for select using (true);
create policy "Public read leaderboard" on leaderboard for select using (true);
create policy "Public read encounter_history" on encounter_history for select using (true);
create policy "Public read playbooks" on playbooks for select using (true);

-- Service role handles all writes (via API routes)
-- No insert/update/delete policies for anon — all mutations go through server
