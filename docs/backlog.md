# Backlog

## Dosha Reminder (Deferred)

- Status: deferred
- Date: 2026-04-03
- Scope:
  - `dosha-reminders` cron disabled in `vercel.json` (Hobby plan restriction + delivery channels not configured yet).
  - Reminder logic stays in codebase but not scheduled automatically.
- Return when:
  - user profile model is finalized (`platform_users` + segmentation fields),
  - delivery channel is chosen and configured (email/telegram/push),
  - opt-in/opt-out and limits are approved for production.
