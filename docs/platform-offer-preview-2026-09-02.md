# Offer preview and cover fallback — 2026-09-02

- Marketplace offer-card titles use at most two lines at every viewport. The
  shared hard title ceiling is 48 characters, measured as two 24-character
  mobile lines; legacy data still has a CSS clamp as a defensive fallback.
- The course-outline accordion shows its semantic structure and lessons, not
  module/lesson totals. Counts are not course-decision evidence and add visual
  noise to the outline.
- A course's optional mobile portrait is verified before it becomes the active
  `<picture>` source. If a Storage object has been deleted, the desktop cover
  remains visible and receives its authored mobile crop instead of producing a
  broken image.

These are runtime presentation and resilience decisions; no shared RAverse
canon update is required.
