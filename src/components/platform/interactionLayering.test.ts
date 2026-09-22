import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(css)?.[1] ?? "";
};

describe("platform interaction layers", () => {
  it("uses ink, not a material plate, for navigation hover and current state", () => {
    for (const selector of [".cw-tab:hover", ".cw-tab-active", ".cw-nav-link:hover", ".cw-nav-link-active"]) {
      const declarations = rule(selector);
      expect(declarations).toBeTruthy();
      expect(declarations).not.toMatch(/background|border-color|box-shadow|translateY/);
    }

    expect(css).toContain(".cw-ink-label-mark");
    expect(css).toContain(".cw-ink-icon-mark");
    expect(css).toContain('[aria-pressed="true"]');
    expect(css).toContain('[aria-current="page"]');
  });

  it("keeps material hover only for physical rows, and none for a list item with controls in it", () => {
    // A list item holds its own controls, so it is not one target and does not
    // fill under the pointer (docs/card-interaction-2026-09-20.md).
    expect(css).not.toContain(".cw-list-item:hover");
    expect(rule(".cw-row-hover:hover")).toContain("--cw-mat-hover-bg");
    expect(rule(".cw-page-btn:hover")).not.toContain("background");
  });

  it("limits the whole-object recipe to the cabinet course card", () => {
    const cabinet = read("src/components/platform/cabinet/Cabinet.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const cabinetRule = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(cabinet)?.[1] ?? "";
    };

    // Generic cabinet cards also hold static information and recovery actions.
    // Only the course frame is one routed object.
    expect(cabinetRule(".card")).not.toContain("cw-object");
    expect(cabinetRule(".courseCardFrame")).toContain("cw-object");
    expect(cabinetRule(".shelfCourseCard")).toContain("cw-object");
  });

  it("uses the same raised elevation for selected objects as for hover", () => {
    expect(rule(".cw-object:hover")).toContain("--cw-mat-shadow-raised");
    const selected = rule(".cw-object[data-selected]");
    expect(selected).toContain("--cw-mat-shadow-raised");
    expect(selected).toContain("--ds-button-lift");
  });

  it("keeps one short material shadow for cards and gives every rail edge room", () => {
    const tokens = read("data/design-tokens/cw.tokens.json");
    const carousel = read("src/components/platform/PlatformOfferCarousel.module.css");

    expect(tokens).toContain('"--cw-mat-shadow-soft": "0 2px 4px');
    expect(tokens).toContain('0 6px 16px');
    expect(tokens).toContain('"--cw-mat-shadow-raised": "0 3px 6px');
    expect(tokens).toContain('0 8px 18px');
    expect(tokens).not.toContain('0 24px 56px');
    expect(tokens).not.toContain('0 28px 60px');
    expect(carousel).toContain("padding: var(--cw-space-sm);");
    expect(carousel).toContain("margin: calc(var(--cw-space-sm) * -1);");
  });

  it("uses one dot per full card on a phone and one dot per page above it", () => {
    const carousel = read("src/components/platform/PlatformOfferCarousel.tsx");

    expect(carousel).toContain('window.matchMedia("(max-width: 560px)").matches');
    expect(carousel).toContain("const pages = phone ? visibleCount");
    expect(carousel).toContain("const targetOffset = cards[index]?.offsetLeft;");
    expect(carousel).toContain("targetOffset - firstOffset");
  });

  it("puts every author surface on the shared paged carousel", () => {
    for (const source of [
      read("src/components/platform/blocks/trust/guides.tsx"),
      read("src/components/platform/ConsultantDirectory.tsx"),
      read("src/app/(platform)/experts/page.tsx"),
    ]) {
      expect(source).toContain("PlatformOfferCarousel");
      expect(source).not.toContain("guideRail");
      expect(source).not.toContain("consultantRail");
    }
  });

  it("keeps native text selection out of controls without blocking reading or editing", () => {
    expect(css).toContain("user-select: none");
    expect(css).toContain('[role="menuitemcheckbox"]');
    expect(css).toContain('input:not([type="checkbox"]):not([type="radio"])');
    expect(css).toContain("user-select: text");
  });

  it("keeps the resting stroke to links in running copy and the one aggregate crossing", () => {
    /* The `link` variant draws its stroke before anyone touches it, which is
       the affordance a link needs when nothing else marks it out — inside a
       sentence, or standing alone beside a heading on a touch screen where
       there is no hover to reveal anything.

       `PlatformBlockLink` JOINED THIS LIST ON 2026-09-06, and the count below
       is the point of the test rather than an exception to it. The crossing to
       an aggregate page had grown three shapes — this component in block heads,
       a hand-rolled copy in the carousel's footer, another in the cabinet — and
       collapsing them onto one component meant choosing one resting state for
       all three. It is the visible stroke: the arrow beside the label is a 12px
       glyph, which is not an affordance on its own, and the hover that used to
       carry the mark does not exist on a phone.

       What the loop still guards is that the strength stays a DECISION. Every
       other consumer of a row of ways out — the footer's link row, a nav, a set
       of tabs — is already marked out by being a row, and takes the navigation
       strength: invisible at rest, ink on hover. */
    expect(css).toContain('.cw-ink-label[data-cw-ink-variant="link"] .cw-ink-label-mark');

    for (const [rel, allowed] of [
      // One survivor inside a sentence: «якщо ви знайшли помилку — …».
      ["src/components/platform/layout/PlatformFooter.tsx", 1],
      // The aggregate crossing — one component, every surface.
      ["src/components/platform/PlatformBlock.tsx", 1],
      ["src/components/platform/PlatformOfferCarousel.tsx", 0],
      ["src/components/platform/blocks/orientation/hub.tsx", 0],
    ] as const) {
      const source = read(rel);
      const restingLinks = source.match(/InteractionInkLabel variant="link"/g) ?? [];
      expect(restingLinks.length, `${rel} uses the resting stroke ${restingLinks.length} time(s)`).toBe(allowed);
    }

    /* The rail reports its position and nothing else: the way out moved to the
       section head, so the carousel must not grow a second one back. It has no
       destination of its own, which is why it imports no link at all. */
    const carousel = read("src/components/platform/PlatformOfferCarousel.tsx");
    expect(carousel).not.toMatch(/from "next\/link"/);
    expect(carousel).not.toMatch(/viewAllHref[?:]/);

    const carouselCss = read("src/components/platform/PlatformOfferCarousel.module.css");
    expect(carouselCss).toContain("grid-auto-columns: 100%;");
  });

  it("moves every shared admin navigation consumer onto the ink primitives", () => {
    const tabs = read("src/components/admin/AdminTabs.tsx");
    const layout = read("src/app/(platform)/admin/AdminShell.tsx");
    const pagination = read("src/components/admin/AdminPagination.tsx");

    expect(tabs).toContain("InteractionInkLabel");
    expect(tabs).toContain("aria-pressed=");
    expect(layout).toContain("InteractionInkLabel");
    expect(layout).toContain("InteractionInkIcon");
    expect(layout).toContain("aria-current=");
    expect(pagination).toContain("InteractionInkIcon");
  });

  it("marks selection with one stroke at two weights, and never with an edge", () => {
    const accountMenu = read("src/components/platform/layout/PlatformAccountMenu.tsx");
    const shelfFilter = read("src/components/platform/cabinet/ShelfFilter.tsx");
    const shelfCss = read("src/components/platform/cabinet/ShelfFilter.module.css");

    /* ONE MARK, FULL LENGTH, AT TWO WEIGHTS (decided 2026-09-10).
       This test previously asserted the opposite — that a menu row, a tab, a
       nav item and a crumb each took a rounded ink EDGE (`variant="tab"`)
       while only a checkbox row kept the stroke. On screen that edge became a
       ring around whichever row you had last touched, sitting on top of the
       stroke that already answers «where am I»: one state said twice, which is
       the very defect the split was reaching for.

       So the edge is gone. Selection is the stroke, drawn to the FULL width of
       the word in every state — the states differ in opacity, weight and
       colour, never in how much of the word is covered. `variant="tab"`
       survives as a NAME that resolves to that stroke, the same way `menu`
       does, so the call sites the rollout touched need no edits.

       The progressive draw that made a partial stroke look honest is a MOTION
       pass, not the resting grammar: it stays in `114dde36` and its specimen,
       to be applied on top of a mark that is already whole. Nothing in the
       resting CSS may clip it. */
    expect(css).toContain('[data-cw-ink-variant="menu"]');
    expect(css).not.toContain(".cw-ink-label-box");
    expect(css).not.toContain("stroke-dasharray:");
    expect(css).not.toContain("stroke-dashoffset:");
    expect(accountMenu).toContain("InteractionInkLabel variant=");
    expect(shelfFilter).toContain('InteractionInkLabel variant="menu" active={query.categories.includes(one)}');
    expect(shelfCss).not.toContain("cw-ink-label-mark");
  });

  it("leaves no module holding its own copy of a state mark", () => {
    /* Four modules each carried a hand-copy of the stroke recipe — offset,
       weight, tilt, dasharray — and the dasharray note in globals.css is the
       post-mortem of one fix having to land in four places and landing
       correctly in none. The topbar and the trail now ask the primitive for
       the mark; nothing in either module draws one. */
    for (const rel of [
      "src/components/platform/PlatformShell.module.css",
      "src/components/platform/PlatformTrail.module.css",
    ]) {
      const sheet = read(rel);
      expect(sheet, `${rel} still declares a mark`).not.toMatch(/^\.\w*[Ii]nkMark\s*\{/m);
      expect(sheet, `${rel} still draws a stroke`).not.toContain("stroke-dasharray");
    }

    /* The builder held the last copy, and for one day it was not even the same
       drawing: a border and a radius — a rounded edge around the label — while
       the rest of the product marked a text choice with the stroke. It shipped
       that way. It now holds no mark at all: `InkLabel` renders the primitive's
       own graphic and globals.css drives it, so the assertion here is the same
       one the two modules above answer. */
    const builder = read("src/components/builder/Builder.module.css");
    expect(builder, "the builder still declares a mark").not.toMatch(/^\.\w*[Ii]nkMark\s*\{/m);
    expect(builder, "the builder still draws a stroke").not.toContain("stroke-dasharray");

    /* And its rows are attached to that contract. The attribute is what hands
       a builder row to the shared hover rules; without it a row renders the
       mark and nothing ever reveals it. */
    for (const rel of [
      "src/components/builder/BuilderModuleEditor.tsx",
      "src/components/builder/BuilderFields.tsx",
      "src/components/builder/BuilderContents.tsx",
    ]) {
      expect(read(rel), `${rel} renders ink labels with nothing to trigger them`).toContain("data-cw-ink-control");
    }
  });

  it("holds the public catalogue filter to the shelf's recipe rather than a second copy", () => {
    const filter = read("src/components/platform/PlatformCatalogFilter.tsx");
    const filterCss = read("src/components/platform/PlatformCatalogFilter.module.css");

    // Every selected option is the canonical compound-control gesture: kinds,
    // subjects and the free switch alike.
    expect(filter).toContain('InteractionInkLabel variant="menu" active={query.kinds.includes(kind)}');
    expect(filter).toContain('InteractionInkLabel variant="menu" active={query.categories.includes(category)}');
    expect(filter).toContain('InteractionInkLabel variant="menu" active={query.freeOnly}');
    expect(filterCss).not.toContain("cw-ink-label-mark");

    // The bounded control recipes are composed from the shelf, not restated —
    // one edge, one counter, one popover across both surfaces.
    for (const recipe of ["find", "filterToggle", "filterCount", "filterPopover", "filterCheckbox"]) {
      expect(filterCss).toContain(`composes: ${recipe} from "./cabinet/ShelfFilter.module.css";`);
    }
  });

  it("keeps both shelves on the same post-filter and presentation primitives", () => {
    const library = read("src/components/platform/cabinet/LearnShelfClient.tsx");
    const workshop = [
      "src/components/builder/BuilderCourseList.tsx",
      "src/components/builder/BuilderCourseEntry.tsx",
      "src/components/builder/BuilderImportPanel.tsx",
    ]
      .map(read)
      .join("\n");
    const presentation = read("src/components/platform/cabinet/ShelfPresentation.tsx");
    const presentationCss = read("src/components/platform/cabinet/ShelfPresentation.module.css");
    const filterCss = read("src/components/platform/cabinet/ShelfFilter.module.css");

    expect(library).toContain("<ShelfResultBar");
    expect(library).toContain("<ShelfPresentation");
    expect(library).toContain("cab.materialsCount(shelf.length)");
    expect(workshop).toContain('title="Матеріали"');
    expect(workshop).toContain('lead="Створюйте, редагуйте та публікуйте навчальні матеріали."');
    expect(workshop).toContain("<ShelfResultBar");
    expect(workshop).toContain("<ShelfPresentation");
    expect(presentation).toContain("InteractionInkIcon");
    expect(presentationCss).toContain("border-image: var(--cw-rule-fade-x)");
    const filterToggle = /\.filterToggle\s*\{([\s\S]*?)\n\}/.exec(filterCss)?.[1] ?? "";
    expect(filterToggle).toContain('composes: secondary from "../PlatformButtons.module.css";');
    expect(filterToggle).toContain('composes: hug from "../PlatformButtons.module.css";');
    expect(filterToggle).toContain("min-height: var(--ds-touch-target-min);");
    expect(filterToggle).not.toContain("cw-ink-icon");
    expect(filterCss).toContain("flex: 0 0 1.15rem;");
  });

  it("keeps loading title-free and starts the learner breadcrumb beside the wordmark", () => {
    const library = read("src/components/platform/cabinet/LearnShelfClient.tsx");
    const courseTrailCss = read("src/components/lms/Lms.module.css");

    const loadingBlock = /const shelfLoading\s*=\s*\(([\s\S]*?)\n\s*\);/.exec(library)?.[1] ?? "";
    expect(loadingBlock).toContain("<PlatformLoadingState");
    expect(loadingBlock).not.toContain("<PlatformPageHead");
    const courseTrail = /\.courseTopbarTrail\s*\{([^}]*)\}/.exec(courseTrailCss)?.[1] ?? "";
    expect(courseTrail).not.toContain("margin-inline: auto");
  });

  it("shares the workspace header with the Builder while keeping admin navigation route-local", () => {
    const layout = read("src/app/(platform)/admin/AdminShell.tsx");
    const rail = read("src/app/(platform)/admin/AdminLayout.module.css");
    const workspaceTokens = read("src/app/globals.css");

    expect(layout).toContain("<PlatformHeader");
    expect(layout).toContain('surface="personal"');
    expect(layout).toContain('mode="workspace"');
    expect(layout).not.toContain("workspaceMobileContent");
    expect(layout).toContain('name={expanded ? "arrow-left" : "arrow-right"}');
    expect(layout).not.toContain("LanguageSwitcher");
    expect(rail).toContain("var(--cw-workspace-side-panel-width)");
    expect(rail).toContain("var(--cw-rule-fade-y)");
    expect(rail).toContain("var(--cw-rule-fade-x)");
    expect(rail).toContain("var(--cw-workspace-panel-motion)");
    expect(workspaceTokens).toContain("--cw-workspace-side-panel-width");
  });

  it("gives every legacy icon-only utility a drawn ring", () => {
    const tsxFiles = fs
      .readdirSync(path.join(root, "src"), { recursive: true })
      .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".tsx"));
    const missing: string[] = [];

    for (const rel of tsxFiles) {
      const source = read(`src/${rel}`);
      for (const match of source.matchAll(/className=(?:"[^"]*cw-icon-btn[^"]*"|\{`[^`]*cw-icon-btn[^`]*`\})/g)) {
        const nearby = source.slice(match.index, match.index + 420);
        if (!nearby.includes("<InteractionInkIcon")) missing.push(rel);
      }
    }

    expect(missing).toEqual([]);
  });
});

describe("the footer's interactive ink follows the gamma, not a fixed brass", () => {
  /* Comments stripped: these rules are discussed in prose right above
     themselves, and a plain `indexOf` finds the sentence, not the rule. */
  const componentsCss = read("src/components/platform/PlatformComponents.module.css").replace(/\/\*[\s\S]*?\*\//g, "");

  it("keeps the text links out of the quiet-button hover", () => {
    /* `.footer a:hover` is one element more specific than `.footerTextLink:hover`,
       so without the exclusion it wins the cascade whatever the order — and
       lights every footer link to the page ink, which on the night ground is
       cream. Pointing at a link turned it white while the same gesture
       elsewhere turned it brass. */
    expect(componentsCss).toContain(".footer a:not(.footerTextLink):hover");
    expect(componentsCss).not.toMatch(/^\.footer a:hover,$/m);
  });

  it("lights a footer link with the marker, which is ink on cream and brass on graphite", () => {
    const at = componentsCss.indexOf(".footerTextLink:hover");
    const declarations = componentsCss.slice(at, componentsCss.indexOf("}", at));
    expect(declarations).toContain("var(--cw-nav-marker)");
    /* The accent is the same brass in both gammas; using it here put a gold
       hover on a cream page, against the one rule the marker exists to state. */
    expect(declarations).not.toContain("--cw-platform-accent");
  });

  it("rests a footer link in the page ink and saves the brass for hover and focus", () => {
    const at = componentsCss.indexOf(".footer a.footerTextLink {");
    const declarations = componentsCss.slice(at, componentsCss.indexOf("}", at));
    expect(declarations).toContain("color: var(--cw-platform-text)");
    expect(declarations).not.toContain("--cw-nav-marker");
    expect(declarations).not.toContain("--cw-platform-accent");
  });

  it("restates the rule's shape on every ink scope, so the scope's ink is the one drawn", () => {
    /* A custom property that reads another resolves where it is declared: on
       `:root` alone, the fade took the theme border and ignored every scope. */
    const globalsCss = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(globalsCss).toMatch(
      /\[data-cw-rule\]\s*\{\s*--cw-rule-fade-x: linear-gradient\(90deg[^;]*var\(--cw-rule-ink\)/,
    );
    expect(globalsCss).toMatch(
      /\[data-cw-rule\]\s*\{[^}]*--cw-rule-fade-y: linear-gradient\(180deg[^;]*var\(--cw-rule-ink\)/,
    );
  });

  it("keeps the marker itself as the two-sided token it claims to be", () => {
    const globalsCss = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(globalsCss).toMatch(/:root\s*\{[\s\S]*?--cw-nav-marker: var\(--cw-platform-text\);/);
    expect(globalsCss).toMatch(
      /\[data-cw-theme="dark"\],\s*\n\s*\[data-cw-header-tone="dark"\]\s*\{\s*\n\s*--cw-nav-marker: var\(--cw-platform-accent\);/,
    );
  });
});

describe("the footer's own addresses", () => {
  it("sends the Telegram row to the support bot, not to a person's inbox", () => {
    /* It sat beside three channels and read as a fourth, but it was a direct
       message to the founder — no queue, no history, no second reader. */
    const content = read("src/lib/platform/content.ts");
    expect(content).not.toContain("telegram.me/E_Koriakin");
    expect(content).toContain('network: "telegram", href: SUPPORT_BOT_URL');
  });

  it("keeps the bot's address in a leaf module, out of the import cycle", () => {
    /* `tgSupportBotCopy` reads LEARNING_SHELF_HREF from `platform/content`, so
       importing the URL back from it closed a cycle: at module evaluation
       CABINET_URL reached for a constant that had not initialised and the
       platform layout threw on the first request. `tsc` does not see this. */
    const leaf = read("src/lib/supportBotUrl.ts");
    expect(leaf).toContain('export const SUPPORT_BOT_URL = "https://telegram.me/centerway_support_bot"');
    /* No import STATEMENT — the prose above it explains the cycle and names
       the word, which a bare substring check would trip over. */
    expect(leaf).not.toMatch(/^\s*import\s/m);
    expect(read("src/lib/platform/content.ts")).toContain('from "@/lib/supportBotUrl"');
    expect(read("src/lib/telegram/tgSupportBotCopy.ts")).toContain("export { SUPPORT_BOT_URL }");
  });
});

describe("the account menu does not offer a door the bar already carries", () => {
  /* THE RULE MOVED (2026-09-20). It used to be an expression in the menu and
     these two tests read it as text; it now lives beside the question it reads
     — `leadsBackToPublicSite` in `lib/platform/apps.ts`, tested there against
     every surface, including the cabinet that was silently missing from it.
     What is left to check here is that the menu still ASKS rather than growing
     a second copy of the rule: a component that re-derives «am I on the
     storefront» from the pathname is how the two answers drift apart. */
  it("asks apps.ts where the way back belongs instead of deciding for itself", () => {
    const menu = read("src/components/platform/layout/PlatformAccountMenu.tsx");
    expect(menu).toContain("const showHomeRow = leadsBackToPublicSite(here);");
    expect(menu).toContain("{showHomeRow ? (");
    // No local re-derivation, under any of the names this rule has had.
    expect(menu).not.toContain("onPublicSite");
    expect(menu).not.toContain("onPublicHome");
    expect(menu).not.toContain("inPersonalApp");
  });

  it("keeps the row a plain anchor, because it leaves this origin", () => {
    /* `next/link` would prefetch a route this origin does not own and still
       full-load on click — the storefront is another app. */
    const menu = read("src/components/platform/layout/PlatformAccountMenu.tsx");
    expect(menu).toMatch(/\{showHomeRow \? \(\s*\n\s*<a\s*\n\s*href=\{platformHref\}/);
  });
});
