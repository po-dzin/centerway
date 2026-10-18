"use client";

/**
 * The feed's filter: the catalogue's popover (G, 16.10 «делай как фильтр в
 * поповер»). One «Фільтри» button with its count; inside, the eight topics and
 * the authors with their faces. Within a group the ticks add up, between the
 * groups they narrow. «Усі» clears both. The choice lives in the address, so a
 * filtered feed can be shared as a link (`/feed?topic=breathing&author=evgeniy`).
 *
 * Composed from the shelf's recipe (`ShelfFilter.module.css`), as the
 * catalogue's filter is: `contour` for the disclosure, `hybrid` for the rows.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { COURSE_CATEGORY_ICONS, COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import { FEED_TOPICS, feedFilterCount, type FeedFilter as Filter, type FeedTopic } from "@/lib/feed/model";
import type { FeedAuthor } from "@/lib/feed/server";

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function FeedFilter({
  filter,
  authors,
  onChange,
}: {
  filter: Filter;
  authors: FeedAuthor[];
  onChange: (next: Filter) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const count = feedFilterCount(filter);
  const chosen = [
    ...filter.topics.map((topic) => COURSE_CATEGORY_LABELS[topic]),
    ...filter.authors.map((slug) => authors.find((author) => author.slug === slug)?.name ?? slug),
  ];

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterMenu} ref={root}>
        <button
          className={styles.filterToggle}
          type="button"
          aria-label={count > 0 ? `${feedCopy.filter}: ${count}` : feedCopy.filter}
          title={chosen.length ? chosen.join(", ") : undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name="list" size={18} aria-hidden="true" />
          <span>{feedCopy.filter}</span>
          <span className={styles.filterCount} data-empty={count === 0 || undefined} aria-hidden="true">
            {count || "0"}
          </span>
        </button>

        {open ? (
          <div className={styles.filterPopover} role="group" aria-label={feedCopy.filterTitle}>
            <div className={styles.filterPopoverHead}>
              <button
                className={styles.filterClear}
                type="button"
                data-empty={count === 0 || undefined}
                aria-hidden={count === 0 || undefined}
                tabIndex={count === 0 ? -1 : undefined}
                onClick={() => onChange({ topics: [], authors: [] })}
              >
                {feedCopy.filterAll}
              </button>
            </div>

            <p className={styles.groupLabel}>{feedCopy.filterTopics}</p>
            <div className={styles.filterOptions}>
              {FEED_TOPICS.map((topic: FeedTopic) => (
                <label key={topic} className={styles.filterOption}>
                  <input
                    type="checkbox"
                    checked={filter.topics.includes(topic)}
                    onChange={() => onChange({ ...filter, topics: toggle(filter.topics, topic) })}
                  />
                  <span className={styles.filterCheckbox} aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  <span className={styles.optionText}>
                    <Icon name={COURSE_CATEGORY_ICONS[topic]} size={20} />
                    <InteractionInkLabel variant="menu" active={filter.topics.includes(topic)}>
                      {COURSE_CATEGORY_LABELS[topic]}
                    </InteractionInkLabel>
                  </span>
                </label>
              ))}
            </div>

            {authors.length > 1 || filter.authors.length > 0 ? (
              <>
                <p className={styles.groupLabel}>{feedCopy.filterAuthors}</p>
                <div className={styles.filterOptions}>
                  {authors.map((author) => (
                    <label key={author.slug} className={styles.filterOption}>
                      <input
                        type="checkbox"
                        checked={filter.authors.includes(author.slug)}
                        onChange={() => onChange({ ...filter, authors: toggle(filter.authors, author.slug) })}
                      />
                      <span className={styles.filterCheckbox} aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                      <span className={styles.optionText}>
                        <AuthorPortrait
                          photo={author.photo}
                          size="xs"
                          fallback={author.name.trim().charAt(0).toUpperCase()}
                        />
                        <InteractionInkLabel variant="menu" active={filter.authors.includes(author.slug)}>
                          {author.name}
                        </InteractionInkLabel>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
