# Branch cleanup — 2026-09-02

Every branch deleted in this pass, with the commit it pointed at. A branch is
a name, not the work: `git fetch origin <sha>` or GitHub's restore-branch
button brings any of these back as long as the commit is recorded here.

## Merged into main — content already shipped

Deleting these loses nothing: every commit is an ancestor of `main`.

| Branch | Head | Last commit |
|---|---|---|
| `Sergey` | `a6833cad` | 2026-03-13 |
| `Sidorov13-patch-1` | `6f35f854` | 2026-03-10 |
| `Sidorov13-patch-2` | `a163e5d4` | 2026-03-10 |
| `claude/brave-nightingale-c69558` | `91f6bf28` | 2026-06-26 |
| `claude/builder-ds-unification` | `ab72d876` | 2026-08-27 |
| `claude/builder-menu-height` | `b3280c32` | 2026-08-29 |
| `claude/centerway-ds-audit-hero-500fad` | `ec38a936` | 2026-08-27 |
| `claude/centerway-ds-simplification-4760e4` | `03ca763e` | 2026-08-29 |
| `claude/charming-banach-dc318a` | `e3d198b1` | 2026-06-23 |
| `claude/course-program-cards-5d2f2b` | `55940e50` | 2026-08-30 |
| `claude/dazzling-mayer-b50e82` | `5758c0bb` | 2026-08-29 |
| `claude/elated-faraday-3eca69` | `8ec3e352` | 2026-08-28 |
| `claude/elegant-elgamal-b33f8c` | `3b8a577c` | 2026-07-11 |
| `claude/library-room-prototype-f17a4a` | `95b89ff1` | 2026-08-29 |
| `claude/loving-haibt-07eadb` | `7192061d` | 2026-06-25 |
| `claude/loving-khorana-c50ac4` | `af9cd5f4` | 2026-07-06 |
| `claude/priceless-williams-8db295` | `23310057` | 2026-08-29 |
| `claude/reader-chrome-lands` | `13573a4c` | 2026-08-29 |
| `claude/room-camera-08-29` | `c944dbbb` | 2026-08-29 |
| `claude/room-selection-followup-08-29` | `87e0d273` | 2026-08-29 |
| `claude/title-ux-builder-audit-7ce4e1` | `5c5e7a36` | 2026-08-27 |
| `codex/analytics-bot-reports` | `8fab356e` | 2026-06-01 |
| `codex/dynamic-irem-entry-fix` | `98a286e7` | 2026-05-25 |
| `codex/hotfix-userstat-only` | `11356892` | 2026-04-25 |
| `codex/irem-timer-hierarchy` | `b21d6c0b` | 2026-05-25 |
| `codex/landing-funnel-runtime` | `05365d11` | 2026-05-23 |
| `codex/landing-generator-runtime` | `c01a705e` | 2026-04-16 |
| `codex/landing-perf-short-irem` | `f0865d08` | 2026-05-12 |
| `codex/marketplace-immersive-cards` | `880f0f87` | 2026-08-24 |
| `codex/merge-origin-main-20260509` | `72477d55` | 2026-05-09 |
| `codex/platform-full-build-20260525` | `2b830709` | 2026-05-27 |
| `codex/platform-main-current` | `6492a4fb` | 2026-05-11 |
| `codex/platform-refresh-20260524` | `6645d6bc` | 2026-05-25 |
| `codex/platform-unification-wave1` | `13910861` | 2026-05-25 |
| `codex/platform-wave2-complete` | `64ff5ed3` | 2026-06-18 |
| `codex/reboot-host-cta-fixes` | `bbe1644e` | 2026-06-20 |
| `codex/responsive-builder-chrome-20260829` | `5a65c011` | 2026-09-02 |
| `codex/short-youtube-16x9-port8000` | `44d5be0d` | 2026-03-23 |
| `codex/surface-routing-next` | `94b8e542` | 2026-05-12 |
| `codex/wave-01-analytics` | `5681c0d2` | 2026-04-23 |
| `codex/wave-02-dosha-ui` | `686a4fb7` | 2026-04-28 |
| `docs/landing-funnel-network` | `bb8074b6` | 2026-07-01 |
| `feat/analytics-source-ui-polish-20260310` | `b1435767` | 2026-03-19 |
| `feat/centerway-new-landings` | `eafa76d3` | 2026-03-28 |
| `feat/irem-v2-landing` | `1aae9ac6` | 2026-06-21 |
| `feat/landing-network-marketing-copy` | `8d1d6959` | 2026-07-04 |
| `feat/landing-unified-ds` | `44c6afd8` | 2026-07-04 |
| `feat/premium-lead-forms` | `6534fb0a` | 2026-07-01 |
| `feat/way21-pricing-polish` | `d587ed54` | 2026-07-01 |
| `fix/header-tone-follows-theme` | `97b9638a` | 2026-08-29 |
| `fix/irem-hero-photo-blend` | `0223e6bf` | 2026-06-30 |
| `fix/irem-host-reveal-sticky` | `8e004717` | 2026-07-01 |
| `fix/irem-ios-hero-fade-v2` | `2bea92e5` | 2026-06-26 |
| `fix/irem-v2-from-claude` | `383c7092` | 2026-06-21 |
| `fix/irem-visual-refresh` | `23b992a1` | 2026-07-01 |
| `fix/legacy-cutover-redirect-loop` | `20bcb350` | 2026-07-03 |
| `fix/mute-sale-telegram-report` | `88c57d83` | 2026-07-29 |
| `fix/reader-top-simplify` | `353b0478` | 2026-08-29 |
| `fix/remove-old-irem-v2-pages` | `472f2978` | 2026-06-24 |
| `fix/tokens-touch-target-drift` | `e0c7dbc9` | 2026-07-02 |
| `po-dzin-patch-1` | `a6279680` | 2026-04-06 |
| `refactor/static-landing-migration` | `85ccb641` | 2026-07-01 |
| `vercel/install-vercel-web-analytics-iswqvv` | `51d2f23b` | 2026-05-20 |
| `worktree-phase-minus-1-hardening` | `e23932cd` | 2026-08-28 |

## Stash captures — abandoned working state

These are `git stash` entries pushed to the remote when a session had to
switch branches, not authored work: their subjects are the stash template
(`WIP on …`, `index on …`, `untracked files on …`). None is reachable from
`main`, so the head SHA below is the only way back to them.

| Branch | Head | Subject |
|---|---|---|
| `archive/pre-stash-pop-2026-08-26` | `554104e1` | On claude/centerway-ds-simplification-4760e4: wip: short-cou |
| `archive/stash-2026-05-11-platform-routing` | `51e2d1fb` | On codex/platform-main-current: codex-temp-before-main-merge |
| `archive/stash-2026-05-25-platform-refresh` | `826e2a45` | On codex/platform-refresh-20260524: autostash |
| `archive/stash-2026-06-21-irem-polish` | `073b94f7` | WIP on main: 7bd1fa1 feat: add irem-v2 landing page |
| `archive/stash-2026-06-22-irem-v2-redundant` | `9db46810` | On claude/charming-banach-dc318a: pre-sync local irem-v2 (re |
| `archive/stash-2026-06-25-launch-config` | `3f2c58cd` | WIP on claude/funny-lamport-d1facc: f1d953c Merge pull reque |
| `archive/stash-2026-06-26-irem-ios` | `c2171af3` | WIP on fix/irem-ios-hero-fade-v2: 2bea92e fix(admin): declar |
| `archive/stash-2026-06-29-irem-cutover` | `d43654f3` | On fix/irem-hero-photo-blend: pre-merge-main-2026-06-29-fix- |
| `archive/stash-2026-07-13-way21-resetday` | `e832d104` | On codex/short-irem-course-refresh: codex-pre-sync-way21-res |
| `archive/stash-2026-08-28-0550-cabinet` | `91bf560d` | On claude/centerway-ds-simplification-4760e4: wip: concurren |
| `archive/stash-2026-08-28-2037-builder-autofix` | `91fa70db` | On claude/centerway-ds-simplification-4760e4: autofix-pr173: |
| `archive/stash-2026-08-28-2113-builder-readiness` | `3447ed34` | WIP on claude/centerway-ds-simplification-4760e4: 1e0f9da9 M |
| `archive/wip-preview-8030-launch-config` | `d7a67181` | On worktree-preview-8030: archive: obsolete preview launch c |

## Kept

`claude/dark-theme-cabinet-hero` (`aa6d93a4`) and
`codex/short-irem-course-refresh` (`a36daf4b`) hold real unmerged commits.
Both read as superseded — `main` solved the same problems later and
differently — but that is a judgement about authored work, not noise, so
they are left standing for a human to close.
