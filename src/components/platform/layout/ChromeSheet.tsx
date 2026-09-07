"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import styles from "@/components/platform/PlatformShellStyles";

/**
 * WHAT A CONTROL IN THE CHROME OPENS.
 *
 * Extracted from `PlatformAccountMenu` on 2026-09-06, when the phone gained a
 * SECOND island: a burger holding the surface's route map beside the avatar
 * holding the account. Before that the account control was the only thing that
 * opened a sheet, so the measuring, the portal, the tone and the three forms
 * lived inside it — and the second control would have had to copy a hundred
 * lines of positioning, which is how the topbar came to have two glasses.
 *
 * IT OWNS THE GEOMETRY AND NOTHING ELSE. What is in the sheet is the caller's
 * business; where it lands, what it is made of and how it closes is this.
 *
 * THREE FORMS, and the reasons are unchanged from the account menu's own note:
 *
 *   · `popover` — a 17rem card under a trigger on a wide bar, opaque because
 *     it opens over whatever the page happens to have there.
 *   · `sheet` — the bar's band continued to the full width of the viewport,
 *     for a phone that still has a bar (the admin panel's, historically).
 *   · `organs` — the floating pair's own column, unfolding from the row's TOP
 *     so the islands come to rest INSIDE the sheet rather than over a hole in
 *     it. See `--platform-organs-inset` in PlatformShell.module.css.
 *
 * The class names are the account menu's (`profileMenu`, `profileMenuScrim`).
 * They were already shared by three surfaces before this split; renaming them
 * is a separate pass, and one that touches CSS the tests read by name.
 */
export type ChromeSheetForm = "popover" | "sheet" | "organs";

/**
 * THE THREE ELEMENTS ARE STATE, NOT REFS, and that is not a style choice. A
 * hook that returns an object holding `useRef` values is ref-bearing as far as
 * the React compiler is concerned, so every read of it in a render — even
 * `sheet.open` — is reported as reading a ref during render
 * (`react-hooks/refs`). Callback refs that assign into a ref do not help: the
 * assignment is what taints them. Holding the nodes in state removes the refs
 * altogether, costs one render when an element attaches, and is what the
 * effects below actually want — they need to re-register when the panel mounts,
 * which a ref does not tell them.
 */
export type ChromeSheet = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  form: ChromeSheetForm;
  anchor: CSSProperties | null;
  tone: "light" | "dark" | null;
  /** The element the outside-click test treats as «inside the control». */
  attachWrap: (node: HTMLDivElement | null) => void;
  /** The control the sheet is measured and anchored from. */
  attachTrigger: (node: HTMLButtonElement | null) => void;
  /** The panel itself — also «inside», though it lives in a portal. */
  attachMenu: (node: HTMLDivElement | null) => void;
};

export function useChromeSheet(): ChromeSheet {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  /* The sheet is portalled to `document.body`, so it does NOT inherit the bar's
     tone scope — and the bar has one: `headerTone` flips the topbar to the
     night material whenever it floats over a dark hero. Left behind on the
     light side of that flip, the panel came out as a 30% cream tint with
     near-black ink on a graded photograph.

     `null` where there is NO BAR TO SAMPLE — the floating islands. Stamping a
     tone there was not a harmless default: `[data-cw-header-tone="light"]`
     re-declares `--cw-nav-marker` as the ink, so on the night theme the menu
     carried a cream ring on the current row while the page marked everything
     in gold. No bar, no verdict; the sheet inherits the theme. */
  const [tone, setTone] = useState<"light" | "dark" | null>("light");
  const [form, setForm] = useState<ChromeSheetForm>("popover");
  const [wrap, attachWrap] = useState<HTMLDivElement | null>(null);
  const [menu, attachMenu] = useState<HTMLDivElement | null>(null);
  const [trigger, attachTrigger] = useState<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  /* PORTALLED AND MEASURED, and this is why: the header is `overflow: clip` —
     it is a rounded frosted plate and the nav sheet slides inside it — so a
     panel positioned against the trigger laid out correctly under the bar and
     was then clipped away in full. Anchoring by measured rect rather than by
     CSS, because a fixed element inside the header would be clipped too: the
     bar's `backdrop-filter` makes it a containing block for fixed
     descendants. */
  const measure = useCallback(() => {
    if (!trigger) return;
    /* Anchored to the BAR, not to the trigger. A control sits inside the
       header's own inline padding, so aligning to it hung the sheet a
       centimetre short of the plate above it — two right edges a few pixels
       apart, which reads as a misplaced popover rather than as a panel
       belonging to the bar. */
    const bar = trigger.closest("header");
    /* THE ISLANDS ARE AN ANCHOR TOO. Where the chrome is floating pills rather
       than a band, `closest("header")` finds nothing; the sheet belongs to the
       ROW — the same gutters, the same centred ceiling — so it unfolds within
       the pair's own column instead of pinning itself to the viewport edges. */
    const organs = trigger.closest('[data-cw-chrome="organs"]');
    const rect = (bar ?? organs ?? trigger).getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    /* The platform's own mobile line, not a new one — see
       PlatformResponsive.module.css, where the bar becomes a phone bar at the
       same width. */
    const asSheet = window.innerWidth <= 900;
    const asOrgans = Boolean(organs && !bar && asSheet);
    setForm(asOrgans ? "organs" : asSheet ? "sheet" : "popover");
    const edge = Math.max(rect.bottom, triggerRect.bottom);
    /* The drawer hangs OFF the bar — no gap, or the band and the sheet read as
       two plates. The popover keeps its 8px of daylight. The island form uses
       neither: it opens AT the row's own top and takes the pair inside itself. */
    const top = Math.round(edge + (asSheet && !asOrgans ? 0 : 8));
    const maxHeight = `${Math.max(192, Math.round(window.innerHeight - edge - 16))}px`;
    if (asOrgans) {
      setAnchor({
        top: `${Math.round(rect.top)}px`,
        left: `${Math.round(rect.left)}px`,
        width: `${Math.round(rect.width)}px`,
        maxHeight: `${Math.max(192, Math.round(window.innerHeight - rect.top - 16))}px`,
        ["--platform-organs-inset" as string]: `${Math.round(Math.max(rect.height, triggerRect.height))}px`,
      } as CSSProperties);
      return;
    }
    setAnchor(
      asSheet
        ? { top: `${top}px`, maxHeight }
        : {
            top: `${top}px`,
            right: `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`,
            maxHeight,
          },
    );
  }, [trigger]);

  const toggle = useCallback(() => {
    measure();
    setOpen((value) => !value);
  }, [measure]);

  useEffect(() => {
    if (!open) return;

    /* The bar is sticky, so scrolling usually does not move the trigger — but a
       short page and a zoomed viewport both can, and a sheet that drifts off
       its control reads as a bug in the bar rather than in the panel. */
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    /* WATCHED, not sampled once at open. The bar decides its tone from what it
       measures behind it, and that verdict lands a frame or more after the
       click that opened this sheet. */
    const bar = trigger?.closest("header") ?? null;
    const syncTone = () => setTone(bar ? (bar.dataset.cwHeaderTone === "dark" ? "dark" : "light") : null);
    const observer = bar ? new MutationObserver(syncTone) : null;
    observer?.observe(bar as HTMLElement, { attributeFilter: ["data-cw-header-tone"] });
    syncTone();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure, trigger]);

  /* THE ROW IS RAISED WHILE ITS SHEET IS OPEN. The sheet unfolds from the row's
     top edge and the row's own `z-index: 4` is nowhere near the portal's layer,
     so without this the islands would be painted over by the panel they opened.
     CSS in ChromeOrgans.module.css does the lifting. */
  useEffect(() => {
    if (!open || form !== "organs") return;
    const organs = trigger?.closest('[data-cw-chrome="organs"]') as HTMLElement | null;
    if (!organs) return;
    organs.dataset.cwOrgansSheet = "open";
    return () => {
      delete organs.dataset.cwOrgansSheet;
    };
  }, [open, form, trigger]);

  /* Escape and outside-click, both required: the sheet sits over the page on
     every surface, and on a phone in learning mode it is the only thing between
     the reader and the lesson. */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      /* Both, because the panel is not a descendant of the wrapper: it lives on
         `document.body`. Testing the wrapper alone would close the sheet on the
         first click INSIDE it. */
      if (wrap?.contains(target) || menu?.contains(target)) return;
      close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close, wrap, menu]);

  return { open, toggle, close, form, anchor, tone, attachWrap, attachTrigger, attachMenu };
}

/**
 * The panel itself, portalled, with the modal shield the two full-width forms
 * need and the popover does not — it is small, anchored, and dismissed by the
 * outside-click above.
 */
export function ChromeSheetPanel({
  open,
  anchor,
  form,
  tone,
  close,
  attachMenu,
  label,
  children,
}: {
  open: boolean;
  anchor: CSSProperties | null;
  form: ChromeSheetForm;
  tone: "light" | "dark" | null;
  close: () => void;
  attachMenu: (node: HTMLDivElement | null) => void;
  /** What this sheet is, for the shield's close button. */
  label: string;
  children: ReactNode;
}) {
  if (!open || !anchor || typeof document === "undefined") return null;

  return createPortal(
    <>
      {form === "sheet" || form === "organs" ? (
        <button
          type="button"
          className={styles.profileMenuScrim}
          data-cw-scrim="chrome"
          /* THE SHIELD STARTS WHERE THE CHROME ENDS, AND FOR THE ISLANDS THAT IS
             THE TOP OF THE VIEWPORT (2026-09-07). A drawer shields the page and
             never the bar it hangs off — which is why `top` is the measured
             edge for the two anchored forms. The island sheet has no bar above
             it: it BEGINS at the row and takes the pair inside itself, so the
             strip between the status bar and the sheet's top edge is page, and
             leaving it unshielded drew a hard unblurred band across the top of
             an otherwise frosted screen. */
          style={{ top: form === "organs" ? 0 : anchor.top }}
          tabIndex={-1}
          aria-label={`Закрити ${label}`}
          onClick={close}
        />
      ) : null}
      <div
        className={styles.profileMenu}
        style={anchor}
        role="menu"
        ref={attachMenu}
        data-cw-glass="shell"
        data-cw-header-tone={tone ?? undefined}
        data-form={form}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
