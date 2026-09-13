# 0005 — The admin is keyed, the public surface writes its Ukrainian in place

2026-09-11. Status: accepted.

## Context

Two vocabularies were in the repository and neither was written down, so every
new string was a small argument. `src/lib/i18n.ts` held 655 keyed strings in two
locales for the admin panel and nothing else. The public surface kept its
Ukrainian inline across 243 files, with six `copy.ts` modules beside it holding
another thousand lines. The audit read that as one pattern too many and asked
for consolidation.

Looking at what the six modules actually are, they are not a competing system.
`doshaResultCopy` exists because the same verdict is delivered on screen and
through Telegram, and two copies of a verdict become two different verdicts.
`tgSupportBotCopy` exists so a bot speaks in one voice. `courseSaveCopy` and
`lessonDocumentCopy` turn a validator's assertion id into a sentence an author
can act on. `profile/copy.ts` and `cabinet/copy.ts` exist because the cabinet
ships two languages.

## Decision

A string is extracted when a second surface says it, or when the surface it is
on ships more than one language. Otherwise it lives where it is rendered.

That is the rule both halves already follow, stated once. The admin is keyed
because it is bilingual and operated by staff who switch; the public surface is
Ukrainian in place because it ships one language and its prose is written, and
re-written, in the component that shows it. The copy modules are the two
conditions above being met, not a third pattern.

The admin dictionary moved to **paired entries** in the same pass —
`src/lib/i18n/<area>.ts`, one line carrying both languages of one string. The
old shape kept the two locales 690 lines apart and had a hole its own test
described: `TranslationKey` was derived from one locale, so a key added to
`en` alone typechecked everywhere and rendered `undefined` on the Ukrainian
panel. A pair cannot be written half. Sixty-nine keys that no source file
referenced — the dashboard page and the nav that preceded the admin's move to
server components — were dropped at the same time.

## Consequences

New admin strings go in the area file, both languages on the line, and the
gate reads the files rather than one object. New public strings go in the
component; a reviewer's question is no longer "should this be extracted?" but
"does a second surface say it?", which has an answer.

The rule is measurable, which is how it earns its keep: 17 Ukrainian sentences
longer than 25 characters were duplicated across files when it was written. Five
were the builder's save and conflict messages, held separately by two editors
and the autosave hook, and already drifted into three different wordings of one
tab conflict — those are now one export. Two are the iOS install instructions,
duplicated between the shell menu and the cabinet's bilingual table, and are
deliberately left: the shell ships one language and the argument is written at
both sites. The rest belong to other decisions (a page that exists at two
routes; product labels that live in three catalogues).

What would reopen this: a second language on the public surface. At that point
inline Ukrainian stops being the cheapest thing that works, the copy modules are
the seam it would grow from, and the paired-entry shape is what it should grow
into — not a return to two objects far apart.
