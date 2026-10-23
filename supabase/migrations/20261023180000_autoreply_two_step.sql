-- Two-step direct message: a greeting with a button, then the link once the
-- person taps it. Both columns stay empty for a one-message rule.
alter table public.autoreply_rules
  add column if not exists open_button_label text,
  add column if not exists follow_up_text text;
