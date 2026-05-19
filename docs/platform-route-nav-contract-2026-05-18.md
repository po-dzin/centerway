# Platform Route Nav Contract 2026-05-18

- surface: `platform routes`
- semantic role: `orientation + route navigation`
- user question: `where are the four main platform entries and how do I move between them without falling into funnel routing?`
- token source: `global app DS + shared platform shell`
- content source: `canon + src/lib/platform/content`
- route boundary: `platform route`

## Rule

Main platform navigation uses four stable route entries only:

1. `/` — головна
2. `/dosha-test` — діагностика
3. `/programs` — дошка всіх програм
4. `/expert` — про автора

## Shell Contract

- header and footer are shared platform shell surfaces across platform routes;
- funnel surfaces keep their own isolated shell rules;
- platform logo in header/footer always resolves to `/`;
- program detail pages link back to `/programs`, not to home anchors.

## Current Intent

This change promotes `/dosha-test` from utility-style entry into the main platform route set and introduces `/programs` as the stable catalog route for current and future programs, authors, and categories.
