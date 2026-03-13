-- Increase personality limit to 500 chars
alter table playbooks drop constraint if exists playbooks_personality_check;
alter table playbooks add constraint playbooks_personality_check check (char_length(personality) <= 500);
