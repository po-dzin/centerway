# Decisions

One file per decision that the code cannot explain on its own: what was
chosen, what it was chosen over, and what would make us revisit it. A note in
`docs/` says what was done on a day; a decision here says what stays true
until someone writes a new file that supersedes it.

Format, kept short on purpose:

```
# NNNN — Title, as a statement

Date. Status: accepted | superseded by NNNN.

## Context
What was true, and what forced a choice.

## Decision
The choice, in one paragraph.

## Consequences
What this makes easy, what it makes hard, and what would reopen it.
```

Numbering is chronological. A superseded decision keeps its file and gains a
status line; it is never rewritten to say something else.

Where a decision was recorded as prose elsewhere before this folder existed
(2026-09-11), the file here is a pointer with the summary, not a copy.
