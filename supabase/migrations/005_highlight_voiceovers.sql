-- Move voiceover data onto each highlight (not per-round)
alter table highlights add column voiceover_script text;
alter table highlights add column voiceover_audio_base64 text;
