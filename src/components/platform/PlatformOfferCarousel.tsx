"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";

import { Icon } from "@/components/Icon";
import styles from "./PlatformOfferCarousel.module.css";

type EdgeState = {
  overflow: boolean;
  previous: boolean;
  next: boolean;
  firstVisible: number;
  lastVisible: number;
  /** Pages the rail actually scrolls through, not cards it carries. */
  pages: number;
  page: number;
};

const INITIAL_EDGE_STATE: EdgeState = {
  overflow: false,
  previous: false,
  next: false,
  firstVisible: 0,
  lastVisible: 0,
  pages: 1,
  page: 0,
};

const MAX_VISIBLE_OFFERS = 10;

/**
 * One carrier for every embedded offer collection.
 *
 * Desktop exposes one page of three cards, tablet two and phone one readable
 * card plus the next edge. The cards stay ordinary server-rendered children;
 * this client boundary owns only viewport measurement and paging controls.
 */
export function PlatformOfferCarousel({
  children,
  label = "Пропозиції CenterWay",
  viewAllHref,
  viewAllLabel = "Увесь список",
}: {
  children: ReactNode;
  label?: string;
  /**
   * Aggregate route for the complete set — ONLY when the block around this
   * carousel has no link of its own. The home blocks carry
   * `PlatformBlockLink` in their head, and passing it here as well printed the
   * same destination twice in one section, above and below the same rail.
   */
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<EdgeState>(INITIAL_EDGE_STATE);
  const items = Children.toArray(children);
  const total = items.length;
  const visibleItems = items.slice(0, MAX_VISIBLE_OFFERS);
  const visibleCount = visibleItems.length;

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const cards = Array.from(viewport.firstElementChild?.children ?? []) as HTMLElement[];
    const viewportStart = viewport.scrollLeft;
    const viewportEnd = viewportStart + viewport.clientWidth;
    const visible = cards.flatMap((card, index) => {
      const overlap = Math.min(card.offsetLeft + card.offsetWidth, viewportEnd) - Math.max(card.offsetLeft, viewportStart);
      return overlap >= card.offsetWidth / 2 ? [index] : [];
    });
    const firstVisible = visible[0] ?? 0;
    const lastVisible = visible.at(-1) ?? firstVisible;
    /* One dot per page of the rail. A dot per card lied on desktop, where a
       page carries three of them: four cards drew four dots for two swipes.
       The last page is usually a partial step, so the position is read off
       how far along the scrollable distance we are, not off scrollLeft
       divided by a page width. */
    const pages = maxScroll > 2 ? Math.ceil(maxScroll / viewport.clientWidth) + 1 : 1;
    const page = maxScroll > 2 ? Math.round((viewport.scrollLeft / maxScroll) * (pages - 1)) : 0;
    const next = {
      overflow: maxScroll > 2,
      previous: viewport.scrollLeft > 2,
      next: viewport.scrollLeft < maxScroll - 2,
      firstVisible,
      lastVisible,
      pages,
      page,
    };

    setEdges((current) =>
      current.overflow === next.overflow &&
      current.previous === next.previous &&
      current.next === next.next &&
      current.firstVisible === next.firstVisible &&
      current.lastVisible === next.lastVisible &&
      current.pages === next.pages &&
      current.page === next.page
        ? current
        : next
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ left: 0, behavior: "auto" });
    measure();
    viewport.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, visibleCount]);

  const scrollBehavior = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? ("auto" as const) : ("smooth" as const);

  const page = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left: direction * viewport.clientWidth,
      behavior: scrollBehavior(),
    });
  };

  /* The dots are the same map read backwards: `measure` turns a scroll
     position into a page, this turns a page back into a scroll position, so a
     tap always lands where its own dot lights up. */
  const goToPage = (index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const steps = Math.max(1, edges.pages - 1);
    viewport.scrollTo({
      left: (maxScroll / steps) * index,
      behavior: scrollBehavior(),
    });
  };

  const queueStart = edges.firstVisible + 1;
  const queueEnd = edges.lastVisible + 1;

  if (total === 0) return null;

  return (
    <div className={styles.carousel} data-overflow={edges.overflow ? "true" : "false"}>
      <div className={styles.stage}>
        <div className={styles.controls} aria-hidden={edges.overflow ? undefined : true}>
          <button
            className={styles.control}
            type="button"
            aria-label="Попередні картки"
            disabled={!edges.previous}
            onClick={() => page(-1)}
          >
            <Icon name="arrow-left" size={20} />
          </button>
          <button
            className={styles.control}
            type="button"
            aria-label="Наступні картки"
            disabled={!edges.next}
            onClick={() => page(1)}
          >
            <Icon name="arrow-right" size={20} />
          </button>
        </div>
        <div
          ref={viewportRef}
          className={styles.viewport}
          role="region"
          aria-roledescription="карусель"
          aria-label={label}
          tabIndex={0}
        >
          <div className={styles.track}>{visibleItems}</div>
        </div>
      </div>
      <footer className={styles.queueFooter}>
        {edges.pages > 1 ? (
          <div className={styles.queueDots}>
            {Array.from({ length: edges.pages }, (_, index) => (
              /* A filled disc, drawn in CSS — the drawn `dot` glyph read as a
                 ring at this size and the current page was told apart by
                 opacity alone. The page you are on is gold and larger. The
                 disc itself stays small; the button around it carries the
                 touch target, so the row keeps its quiet size. */
              <button
                className={`${styles.queueDotButton} ${index === edges.page ? styles.queueDotButtonCurrent : ""}`}
                type="button"
                aria-label={`Сторінка ${index + 1} із ${edges.pages}`}
                aria-current={index === edges.page ? "true" : undefined}
                onClick={() => goToPage(index)}
                key={index}
              >
                <span className={styles.queueDot} />
              </button>
            ))}
          </div>
        ) : null}
        <span className={styles.srOnly}>
          {queueStart === queueEnd ? `Картка ${queueStart}` : `Картки ${queueStart}–${queueEnd}`} із {visibleCount}
        </span>
        {total > MAX_VISIBLE_OFFERS || viewAllHref ? (
          <div className={styles.queueOverflow}>
            {total > MAX_VISIBLE_OFFERS ? (
              <span className={styles.queueRange}>Показано {visibleCount} із {total}</span>
            ) : null}
            <div className={styles.queueActions}>
              {viewAllHref ? (
                <Link className={styles.queueLink} href={viewAllHref} data-cw-ink-control>
                  <InteractionInkLabel>{viewAllLabel}</InteractionInkLabel>
                  <Icon name="arrow-right" size={18} />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
