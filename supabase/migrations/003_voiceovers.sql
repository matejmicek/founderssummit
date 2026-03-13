-- Round voiceovers: one voiceover per round covering all highlights
create table round_voiceovers (
  id uuid primary key default gen_random_uuid(),
  season_id int not null references seasons(id) on delete cascade,
  round int not null,
  script text not null,
  audio_base64 text, -- base64-encoded MP3
  created_at timestamptz not null default now(),
  unique(season_id, round)
);

alter table round_voiceovers enable row level security;
create policy "Anyone can read voiceovers" on round_voiceovers for select using (true);

-- Enable realtime
alter publication supabase_realtime add table round_voiceovers;
