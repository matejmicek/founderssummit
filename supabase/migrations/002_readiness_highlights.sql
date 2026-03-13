-- Team readiness: tracks whether a team is ready for the current round
alter table playbooks add column ready boolean not null default false;

-- Round status: tracks the phase within a round for progress display
alter table seasons add column round_status text not null default 'idle'
  check (round_status in ('idle', 'running_matches', 'generating_highlights', 'showing_highlights'));

-- Highlights: top matches picked by the big model after each round
create table highlights (
  id uuid primary key default gen_random_uuid(),
  season_id int not null references seasons(id) on delete cascade,
  round int not null,
  match_id uuid not null references matches(id) on delete cascade,
  title text not null,
  commentary text not null,
  highlight_type text,
  ranking int not null,
  created_at timestamptz not null default now()
);

alter table highlights enable row level security;
create policy "Public read" on highlights for select using (true);

-- Add realtime for playbooks (ready status) and highlights
alter publication supabase_realtime add table playbooks;
alter publication supabase_realtime add table highlights;
alter publication supabase_realtime add table seasons;
