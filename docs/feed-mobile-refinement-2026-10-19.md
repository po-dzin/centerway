# Feed mobile refinement — 19 October 2026

Current branch fast-forwarded to `origin/main` at `f1cf824c`. Existing local
work was saved in `centerway-before-feed-main-sync-2026-10-19`; four restore
conflicts in the access-grant block kept main's current implementation. The
stash remains as recovery. The pre-existing deletion of `feed_wave2.sql` was
reversed: local replay demonstrated it breaks main's platform-post migration.

## Semantic preflight and review

All surfaces stay within the platform `/feed` route family. Content comes from
the existing feed API/database; copy additions implement the owner's request.
Visual source is the global app DS and existing feed/PlatformButtons recipes.

| Surface | Role / question | Selection family | Boundary |
| --- | --- | --- | --- |
| Feed comments | support: how do I answer this post here? | contour: textarea, send, reply, reaction picker | quiet field/menu; none collection |
| Expanded post | support: where can I read every reply? | contour commands; shared link grammar | none collection |
| Share menu/card | route: how can I pass this post to another app? | contour | quiet menu; none exported media |
| Photo viewer | support: how can I inspect/turn/close the photos? | contour | none canvas; shared onMedia glass commands |
| Topic filter/composer | orientation: what is this post about? | hybrid, existing InteractionInkLabel menu label | essential checkbox, quiet popover |
| Pinned tape | orientation: which post stays pinned? | noninteractive | none |

No local palette, shadow scale, type scale, or ink drawing was introduced.
Controls keep global no-selection; post/comment reading and fields stay selectable.
Transient failures use the application ToastProvider.

## Behavior

- The comment bubble on feed cards opens inline comments and a composer. The
  feed shows the two latest top-level comments; the explicit link opens all
  comments/replies on `/feed/[id]`. Replies can be written inline too.
- Comment textarea uses at least 16px type, a centered single-line height,
  growing content, no manual resize, and a shrinkable grid column. Browser
  zoom remains available; no viewport restriction is added.
- Published comments/replies receive the same emoji picker as posts, with
  three emoji per account/comment and server visibility checks. Held/hidden
  comments and hidden-parent replies cannot be reacted to. Counts batch-load.
- Feed-only `art`, `meaning`, `technology` topics are Арт, Сенс, Технології.
  Course classification is unchanged. Both scalar and array SQL checks expand.
- Shared Telegram/system links carry the URL alone; OG description is the
  post's plain text without the appended brand disclaimer. This removes the
  duplicate text and unrelated appended claim shown in the reference.
- Story sharing prepares a 1080×1920 PNG from the post's author, visible photo
  and plain text. Spoilers remain excluded. Browser file sharing uses a second
  explicit gesture after preparation, preserving transient activation on iOS.
  The OS determines available apps/targets; a website cannot promise to open
  Instagram Stories directly. Telegram `shareStory` requires Mini App context.
  Unsupported file sharing downloads the PNG. File cards contain a readable
  URL, not a guaranteed clickable native story sticker.
- Viewer photos use the whole viewport; close is top-right, arrows/counter are
  overlaid below. Pointer opening focuses the dialog, not the close button;
  keyboard focus stays visible, Escape/swipe/arrows are retained. Body scroll
  locks only while open. Tape keeps its DS material with less symmetric tears.

## Database/release

`20261019120000_feed_comment_reactions_topics.sql` adds the reaction table with
FK cascade, RLS closed to direct user-token access, service-role grant and a
transaction-locked three-reaction limit. TypeScript guards authorize writes.
Rehearse locally; publish/apply to production only in the release cycle.
This is a route-specific contract, documented locally; no cross-platform DS or
shared canon rule is changed.

## Verification

- Local native reset: all 38 pending migrations replayed successfully after
  restoring the required wave-2 file. Generated local types were compared with
  baseline; only the generated new table block is retained, avoiding unrelated
  native-generator changes to JSON types and function signatures.
- Real local SQL transaction: fourth reaction refused; deleting the comment
  cascades reactions. Transaction rolled back.
- Feed unit/route suite: 98 tests passed.
- Canon, button, geometry and DS contract guards passed; changed source files
  pass Prettier. `next build --webpack` passed, including TypeScript. Prerender
  logged network-unavailable reads with existing empty-content fallbacks.
- Production migration drift read: OK (114 applied versions all have SQL).
  Existing warning: two older files share `20261017180000`; this work does not
  rename an applied migration. New `20261019120000` is local-only/pending.
- Chromium browser run at 390×844 and 1440×1000: wrote a comment without
  navigation, persisted its emoji reaction, opened/advanced/closed the viewer,
  downloaded the story PNG. Both had 16px field text, document width equal to
  viewport width and zero page errors. Viewer screenshots and generated PNG
  inspected together. Auth restoration was allowed to settle before input.
- Final lint passed with one existing AccountMenu navigation warning; standalone
  typecheck passed after build refreshed stale Next route types.
- Durable feed behavior was promoted to the smallest relevant section of the
  RAverse UI-UX canon; the full operational detail remains in this local note.
- Mobile WebKit 26.6 confirmation at 390×844 passed comments/reactions and the
  full-screen viewer. Field computed size remained 16px with no horizontal
  overflow or page errors. With a test Web Share handler, the story command
  handed over `centerway-story.png` (`image/png`, nonempty). OS destination
  selection and actual Instagram/Telegram story editors still require a phone.
