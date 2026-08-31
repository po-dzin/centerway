# Builder course workspace polish — 2026-08-31

## Contract

| Change | Semantic role / user question | Token/content/route source | Selection family |
|---|---|---|---|
| Structure representation | representation — rows or cards? | shared `ShelfPresentation`, existing view icons and localStorage preference; Builder course route | `ink` |
| Default course workspace | orientation — what should I configure first? | existing `Обкладинка` workspace and stable hash map; `/build/[course]` | navigation `ink` |
| Page form | offer — what will the programme page say? | existing course storefront fields and validation; `#course-offer` | field controls keep existing families; no disclosure control |

## Implementation

- Replaced the orphaned Builder switch markup with the library/workshop shared
  presentation component. The old local CSS had disappeared, leaving the two
  buttons without geometry and its absolute ink ring positioned against the
  page. Shared controls explicitly compose `base chromeBare square`.
- Centralised workspace hashes and made `course` the fallback only when no
  recognised hash is present. Direct links to content/page/author/release are
  unchanged.
- The Page tab renders its storefront fields directly. Removed the section
  pencil, collapsed summary and the Page panel's leading divider. `Додатково`
  remains the separate technical disclosure.

## Verification

- `courseWorkspace.test.ts` covers default/deep-link routing, shared switch
  composition and the expanded/unframed Page contract.
- No schema, API, draft-storage, validation or publish behaviour changed.
