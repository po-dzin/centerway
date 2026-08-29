-- Support bot: let the session table hold the courses the bot already offers.
--
-- `support_bot_sessions.selected_product` has carried
--     check (selected_product in ('short', 'irem'))
-- since 2026-04-24_tg_support_bot.sql. Commit 563f110 added way21 and reset-day
-- to the bot's product picker and never widened it, so picking either of those
-- two raised 23514 inside `saveSession`. The webhook route swallows the throw
-- and answers Telegram with `{ ok: true, handled: false }` — meaning the button
-- did nothing, silently, with no message back to the user and no error anywhere
-- the operator would look.
--
-- Widened rather than dropped: the column is a small closed set written only by
-- our own `assertProduct`, and a constraint that catches a typo'd product code
-- at the boundary is worth keeping. It just has to list the products that exist.
--
-- Idempotent: drops the constraint by name if present, then adds it back.

alter table public.support_bot_sessions
  drop constraint if exists support_bot_sessions_selected_product_check;

alter table public.support_bot_sessions
  add constraint support_bot_sessions_selected_product_check
  check (selected_product in ('short', 'irem', 'way21', 'reset-day'));

-- `state` is deliberately left as free text. The bot gained
-- 'choosing_product_access' in the same pass, and pinning the state machine's
-- vocabulary in the database would mean a migration for every flow change while
-- buying nothing: the column is written only by the bot and read only by it.
