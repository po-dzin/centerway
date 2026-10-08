# Anchor scroll clearance

Platform section anchors now stop with their content one `--cw-space-md` step
below the floating topbar. The scroll margin subtracts the section or panel's
own top padding, so that padding is not counted twice. The topbar block is
declared from the shared shell geometry and uses the compact header geometry on
mobile.

Managed landing anchors use the existing CSS `scroll-margin` as their runtime
offset. This preserves the network navigation clearance and each section's
padding compensation when the shared script performs its repeatable instant
scroll and post-font correction.

## Preflight / review

| Surface | semantic_role | user_question | content_source | token_source | route_boundary | selection_family |
| --- | --- | --- | --- | --- | --- | --- |
| Platform section anchors | orientation / route | Where does the linked section begin? | Existing platform sections and catalog content | Global app DS spacing and shell topbar geometry | Existing platform route | contour for CTA links; ink for navigation links |
| Managed landing anchors | orientation / offer | Where does the linked landing section begin? | Existing landing content | Existing global/network DS `scroll-margin` and navigation clearance | Existing isolated funnel route | contour for CTA links; ink for navigation links |

No page composition, CTA hierarchy, route boundary, surface boundary, copy, or
ink state changes. Existing native selection behavior remains unchanged.
