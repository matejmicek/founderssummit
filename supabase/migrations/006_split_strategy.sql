-- Split strategy into cooperate_strategy and betray_strategy
alter table playbooks rename column strategy to cooperate_strategy;
alter table playbooks drop constraint if exists playbooks_strategy_check;
alter table playbooks add constraint playbooks_cooperate_strategy_check check (char_length(cooperate_strategy) <= 300);
alter table playbooks add column betray_strategy text not null default '' check (char_length(betray_strategy) <= 300);
