-- Publish the founder's author profile, and give it the portrait his card already used.
--
-- WHY THIS EXISTS. `HubGuides` (the home page's «Про автора» block) stopped
-- reading the hand-written `platformGuides` constant on 2026-08-28 and started
-- reading `listListedAuthors()`, which filters `listed = true`. The founder's
-- row was `listed = false`, so the list came back empty and the block removed
-- itself from the home page. That flag is the whole regression.
--
-- THE PHOTO IS THE ONE THE STATIC CARD ALREADY POINTED AT.
-- `/shared/` is a platform asset root, not a landings-only one: `src/proxy.ts`
-- bypasses it via `INFRA_BYPASS_PREFIXES` in `src/lib/proxy/bypass.ts`, and
-- `scripts/guard-assets.mjs` resolves `/shared/**` against BOTH
-- `src/landing-static/` and `public/`. So the row simply carries the same URL
-- the constant did, and no asset had to move.
--
-- `listed` STILL MEANS "strangers may reach my page". For the founder that
-- page is `/consult`, not `/expert/<slug>` — see `isFounderAuthorSlug` in
-- `src/lib/lms/authors.ts`: his card links there, and `/expert/<either
-- transliteration>` 308s there, so publishing him does not mint the second page
-- about him that the 2026-08-23 `/expert` -> `/consult` merge existed to remove.
--
-- Idempotent: matched by slug, and re-running only re-asserts the same values.

update public.lms_authors
set
  listed = true,
  photo = jsonb_build_object(
    'src', '/shared/img/author-evgeniy-2026-08.webp',
    'alt', 'Євгеній Корякін'
  )
where slug = 'yevhenii-koriakin';
