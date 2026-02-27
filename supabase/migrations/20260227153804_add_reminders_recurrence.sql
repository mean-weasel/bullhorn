alter table reminders
  add column recurrence_rule text,
  add column source_event_id uuid references community_events(id) on delete set null;

create index idx_reminders_source_event on reminders (source_event_id) where source_event_id is not null;
