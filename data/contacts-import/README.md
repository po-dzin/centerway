# Contact imports

Contact bases coming home from outside services: SendPulse, Smart Sender. The
export scripts live in `scripts/contacts/`.

**`raw/` is gitignored and must stay that way.** An export holds personal data:
messenger ids, names, usernames, and answers people gave in bot scenarios. It
lives on the machine that ran the export only until it is imported into
`messaging_subscriptions`, and is deleted after that.

| Source | Script | What it carries |
|---|---|---|
| SendPulse Telegram bots | `node scripts/contacts/sendpulse-telegram-export.mjs` | `telegram_id` (= chat id), username, name, unsubscribe time, scenario variables |

Why the API and not the UI export: the services' CSV exports leave out the
messenger user id, and without it the platform cannot write to anyone. See
`docs/broadcasts-2026-09-15.md`.
