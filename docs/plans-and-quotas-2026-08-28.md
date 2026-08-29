# Plans and quotas — what to meter, and what it actually costs

Status: SHELVED 2026-08-28, the same day it was written — authors are taken on a
revenue share, not a subscription, so there is no plan to enforce. Kept for the
unit costs, which are measured and stay true whoever pays them.

Written alongside the media work,
because the same question produced both: *what does one more course, or one
more student, cost us?*

## Contract

- Surface: the author's cabinet (usage), the authoring API (enforcement), the
  admin sales form (assignment).
- Semantic role: boundary — what this account may do, said before it is refused.
- User question: *what am I paying for, and how much of it have I used?*
- Content source: a plan table in code, a usage ledger in the database.
- Route boundary: `my.` for the author's own usage; enforcement lives on the
  server at the same points that already decide authorship.

## The measured unit costs

Everything below is per month, at the prices Supabase charges past the Pro
allowances ($0.021/GB stored, $0.09/GB egress) and at Sonnet-class token prices.

| Unit | What it consumes | Cost |
|---|---|---|
| One course, 25 lessons, image in half of them | ~6 MB of Storage (renditions × 1.7 for replaced and deleted uploads) | **$0.00013** |
| The same course's lesson JSON | ~250 KB | nothing |
| The same course's version history, 40 saves | ~10 MB of Postgres — a full snapshot per save | ~$0.0002 |
| One student on one course | ~25 KB of rows (enrollment, progress events, annotations) | nothing |
| One student reading one course | ~10 MB of egress (was ~500 MB before the media work) | **$0.0009** |
| One agent turn drafting a lesson (~15k in / 3k out) | tokens | **~$0.09** |

Read that table twice, because it inverts the intuition the question started
from:

**A thousand students cost about a dollar. Forty agent turns cost three and a
half.** Storage, rows and bandwidth are rounding errors at any scale this
product will see in the next few years. Tokens are the entire marginal cost of
the business.

There is one exception worth naming: **version history grows forty times faster
than the course it protects**, because every save writes a whole new snapshot
and the table is deliberately append-only. It is still cheap, but it is the only
line that grows without an author noticing.

## What follows for the shape of the plans

- Limits on courses and students are **packaging**, not cost recovery. They pick
  the value metric — the number that grows when the author's business grows —
  and they should be set where they read as generous, because making them tight
  saves nothing.
- The agent allowance is the one limit that must be **metered exactly**, because
  it is the one that can lose money. It is also the only one where an overage
  should stop work rather than bill silently.
- **A student is never refused.** A hard cap on enrollments turns our packaging
  problem into the author's lost sale, and the author will remember that longer
  than they remember the invoice. Past the limit: allow, record, notify, bill —
  or hold the account at its ceiling and tell the author, but never bounce a
  paying learner at the door.

## Proposed matrix

| | Проба | Автор | Школа |
|---|---|---|---|
| Price / month | 0 | €19 | €79 |
| Published courses | 1 | 5 | 30 |
| Active students | 50 | 500 | 5 000 |
| Media storage | 250 MB | 3 GB | 20 GB |
| Version history kept | last 20 revisions | 180 days | unbounded |
| Agent tokens | — | 500 k | 3 M |
| Over the student line | ceiling, with notice | billed | billed |

Marginal cost at a full Школа account: ~50 GB egress, 20 GB stored, 3 M tokens
≈ **€24 against €79**. At a full Автор account: ≈ **€4 against €19**. Both leave
room for the agent allowance to be the thing that actually varies.

## What has to exist before any of this can be enforced

1. ~~**A media ledger.**~~ **Built 2026-08-28** — `lms_media_assets`, written by
   `/api/lms/authoring/media`, summed by the `lms_media_usage` view. Orphan
   collection came with it (`npm run media:sweep`), though it reads the bucket
   rather than the ledger, and the reasons are worth reading before either is
   extended: `docs/media-weight-2026-08-28.md`.
2. **A plan table.** `platform_plans (user_id, plan, valid_until)`, and one
   source of the limits themselves in code — the way `apps.ts` is the single
   source for the app switcher. A limit that exists in two places is a limit
   that will disagree with itself.
3. **A token ledger.** `agent_usage (user_id, period, tokens_in, tokens_out)`,
   written where the agent call returns, not where it is dispatched — an
   abandoned request still spent the tokens.
4. **Enforcement at the points that already hold authority.** Course creation,
   the media route, enrollment, and the agent entry point each already resolve
   who the caller is; the quota check belongs beside `canEditCourse`, not in a
   policy layer that has its own idea of who an author is.
5. **A retention job for revisions.** Daily — Vercel Hobby refuses any cron more
   frequent than daily and fails the whole deployment if one is declared, so the
   schedule is not a free choice.
6. **A usage panel in the cabinet.** A quota the author cannot see is a quota
   they can only discover by being stopped by it.

## Open questions

- Does the plan attach to the author or to the course? A course with two
  editors has two plans, and the answer decides which one pays.
- Does a downgrade delete? Storage over the new ceiling has to go somewhere, and
  "we removed your images" is the worst sentence in this document. Read-only at
  the old size is the kinder answer and costs almost nothing, per the table
  above.
- Are the student caps counted per course or per account? Per account is the
  number an author recognises; per course is the number that maps to egress.
