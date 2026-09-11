import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import baseStyles from "./PlatformBlocksBase.module.css";
import shellStyles from "./PlatformShell.module.css";
import { mergeStyleModules } from "./mergeStyleModules";

// `.container` lives in the shell module and the block recipes in the base one;
// the frame needs both, and reaching for one alias object keeps the class names
// in the JSX the same as everywhere else on the platform.
const styles = mergeStyleModules([shellStyles, baseStyles]);

/**
 * The one frame every content block on the platform is built in.
 *
 * Before this each block invented its own: some were a heading and a grid,
 * some wrapped the whole thing in a panel and then a stack and then an intro
 * (three containers deep, with the outer one drawing a surface nothing needed),
 * and the heading was sometimes a lone `h2` and sometimes an `h2` inside a
 * flex row with an empty `div` beside it. On a phone the difference reads as
 * the page changing its mind every screen.
 *
 * The frame is head + body, and it never draws a surface of its own. Cards,
 * rails and media inside the body carry their own material; a panel around a
 * grid of panels is the thing that made the herb block look boxed three times.
 */
export function PlatformBlock({
  id,
  label,
  title,
  lead,
  align = "start",
  graphic,
  headActions,
  children,
}: {
  id?: string;
  /** Eyebrow — what part of the journey this is. Optional: not every block earns one. */
  label?: string;
  title: string;
  /** One sentence under the title. The question the block answers, not a summary of it. */
  lead?: string;
  align?: "start" | "center";
  /** A quiet brand mark behind the whole block. Texture, not an illustration. */
  graphic?: "center" | "path";
  /** A link or control that belongs to the whole block (e.g. "усі програми"). */
  headActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={[
        styles.container,
        styles.section,
        styles.blockFlow,
        graphic ? styles.blockGraphic : "",
        graphic === "path" ? styles.blockGraphicPath : "",
      ]
        .filter(Boolean)
        .join(" ")}
      id={id}
    >
      <header className={`${styles.blockHead} ${align === "center" ? styles.blockHeadCentered : ""}`}>
        <div className={styles.blockHeadText}>
          {label ? <p className={styles.label}>{label}</p> : null}
          <h2 className={styles.blockTitle}>{title}</h2>
          {lead ? <p className={styles.blockLead}>{lead}</p> : null}
        </div>
        {headActions ? <div className={styles.blockHeadActions}>{headActions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * "All of them" — a block's link to the page it is a sample of.
 *
 * Lives here rather than in each block because it is the same act every time:
 * this section shows three of something, the aggregate shows the rest. Written
 * per block it drifted immediately into three labels and two shapes, which is
 * how a reader stops recognising it as one affordance.
 *
 * Pass it to `PlatformBlock`'s `headActions`. It is deliberately not automatic —
 * a block whose content IS the whole set (the proof stories, the support form)
 * has no aggregate to point at, and a dead link there is worse than none.
 */
export function PlatformBlockLink({ href, label }: { href: string; label: string }) {
  return (
    /* `data-cw-ink-control` is the opt-in, and it does two things at once: it
       turns off the `.text` role's browser underline and it is what the ink
       rules key on.

       THE STROKE RESTS VISIBLE (`variant="link"`), and it did not always. The
       argument for a hover-only mark was that the arrow already says "this is a
       way out", so a permanent line would announce the same thing twice. That
       held while this was the only shape the crossing took — but the carousel
       and the cabinet each grew their own, and a reader met three different
       affordances for one act. Unifying them meant picking one, and the resting
       stroke is the one that survives being LOOKED AT rather than hovered: on a
       touch screen there is no hover, and the arrow alone is a 12px glyph.
       `link` is exactly the variant `InteractionInkLabel` documents for this —
       "a text link inside a paragraph or a block head", visible at rest, one
       strength quieter than the selection mark. */
    <Link className={styles.blockAction} href={href} data-cw-ink-control>
      <InteractionInkLabel variant="link">{label}</InteractionInkLabel>
      <Icon className={styles.blockActionArrow} name="arrow-right" size={18} />
    </Link>
  );
}
