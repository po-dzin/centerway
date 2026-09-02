"use client";

/**
 * ONE CONTINUOUS CATALOGUE, NARROWABLE — the aggregate rail with a filter over it.
 *
 * WHAT IT IS NOT. It is not a second rail, not a carousel and not a feed. The
 * aggregate-catalogue contract is explicit on all three: an entity's main page
 * shows one comparable set, "категории могут сужать этот каталог через
 * компактные фильтры, но не дробят полный набор на последовательные карусели",
 * and growth is answered by progressive loading on the same surface rather than
 * by an endless personalised stream. So the grid below is exactly the grid that
 * was there before; the control above it removes cards from it and never
 * re-orders, re-groups or re-shapes what remains.
 *
 * WHY THE FILTER STATE IS A CLIENT'S AND THE ADDRESS IS THE SERVER'S. Narrowing
 * has to answer a keystroke, so it cannot be a round trip. But a narrowed
 * catalogue is also a thing a reader SENDS to someone, so the query is written
 * into the address as it changes and read back out on arrival. `replaceState`
 * rather than `push`: five axes typed one field at a time would otherwise bury
 * the back button under a history entry per keystroke.
 *
 * THE SPLIT BETWEEN `filter` AND `card` IS DELIBERATE. The engine reads codes —
 * `kind`, `categories`, `amount` — and the card renders words. A component that
 * filtered on the words it prints would break the day a badge is reworded, and
 * a card that carried the filter's vocabulary would gain a prop for every new
 * axis. See `lib/platform/catalogQuery.ts`.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { PlatformOfferCard, type PlatformOfferCardProps } from "@/components/platform/PlatformOfferCard";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import {
  EMPTY_CATALOG_QUERY,
  catalogFacets,
  filterCatalog,
  isCatalogQueryEmpty,
  readCatalogQuery,
  writeCatalogQuery,
  type CatalogItem,
  type CatalogQuery,
} from "@/lib/platform/catalogQuery";
import { PlatformCatalogFilter, catalogFilterCopy } from "./PlatformCatalogFilter";
import styles from "./PlatformCatalogFilter.module.css";

export type CatalogEntry = {
  key: string;
  /** What the engine compares. Codes and figures, never printed words. */
  filter: CatalogItem;
  /** What the reader sees. Exactly the card this surface rendered before. */
  card: PlatformOfferCardProps;
};

const copy = {
  showing: (shown: number, total: number) => `Показано ${shown} з ${total}`,
  empty: "За цим запитом нічого немає. Спробуйте зняти частину умов або пошукати інакше.",
  reset: "Показати всі",
};

/**
 * A store that never changes — the "am I past hydration" idiom.
 *
 * Module scope because `useSyncExternalStore` re-subscribes whenever this
 * identity changes, and a new function each render would do that every time.
 */
function subscribeNothing(): () => void {
  return () => {};
}

/** «₴» rather than «UAH» — the label sits above a field a person types into. */
function currencyMark(code: string | null | undefined): string | null {
  if (!code) return null;
  return code === "UAH" ? "₴" : code;
}

export function PlatformCatalogBrowser({
  entries,
  currency,
  layout,
}: {
  entries: readonly CatalogEntry[];
  currency?: string | null;
  /** `single` is the rail's own one-column form; the grid is the default. */
  layout?: "single";
}) {
  /* THE ADDRESS IS READ AFTER HYDRATION, NOT DURING THE FIRST RENDER. The server
     renders the unnarrowed catalogue — it is the same page for everybody and it
     is what gets cached and crawled — so seeding state from `location.search`
     while hydrating would be a mismatch against that markup.

     WHY A STORE AND NOT AN EFFECT THAT SETS STATE. "Render empty, then set the
     real value" spends a committed render on a catalogue nobody asked for, and
     the second render is a cascade React has to chase — which is what the
     `set-state-in-effect` rule is about. `useSyncExternalStore` says the same
     thing in the shape React has for it: one answer for the server and the
     hydrating client, another once hydration is done, and the switch is a
     render React schedules itself rather than a write it discovers afterwards.

     TWO SOURCES, ONE ANSWER. `fromAddress` is where the reader ARRIVED;
     `edited` is what they have done since, and it wins the moment it exists —
     including when it is empty, which is what «Показати всі» sets. */
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const fromAddress = useMemo(
    () => (hydrated ? readCatalogQuery(new URLSearchParams(window.location.search)) : EMPTY_CATALOG_QUERY),
    [hydrated],
  );
  const [edited, setEdited] = useState<CatalogQuery | null>(null);
  const query = edited ?? fromAddress;

  /* NOTHING IS WRITTEN BEFORE THE ADDRESS HAS BEEN READ. This effect commits on
     the hydrating render too, where `query` is still the empty one — and it
     would replace `?topic=cleansing` with nothing a moment before the store
     flips and that query is read back. So the arrival query survives by the
     writer waiting for the reader. */
  useEffect(() => {
    if (!hydrated) return;
    const params = writeCatalogQuery(query);
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [hydrated, query]);

  const facets = useMemo(() => catalogFacets(entries.map((entry) => entry.filter)), [entries]);
  const shown = useMemo(
    () => filterCatalog(entries, query, (entry) => entry.filter),
    [entries, query],
  );

  const narrowed = !isCatalogQueryEmpty(query);

  /* A CONTROL WITH NOTHING BEHIND IT IS NOT SHOWN. One card cannot be narrowed
     to fewer than one, so a catalogue of one renders exactly the grid it
     rendered before this component existed — and grows the control the day a
     second offer lands. Same rule the shelf's filter applies to its chips. */
  if (entries.length < 2) {
    return (
      <div className={offerStyles.aggregateRail} data-layout={entries.length === 1 ? "single" : layout}>
        {entries.map((entry) => (
          <PlatformOfferCard key={entry.key} {...entry.card} />
        ))}
      </div>
    );
  }

  return (
    <div className={offerStyles.sectionFlow}>
      <PlatformCatalogFilter
        query={query}
        onChange={setEdited}
        facets={facets}
        currency={currencyMark(currency)}
      />

      {narrowed ? (
        <p className={styles.summary} role="status">
          <span>{copy.showing(shown.length, entries.length)}</span>
          <button className={styles.summaryReset} type="button" onClick={() => setEdited(EMPTY_CATALOG_QUERY)}>
            {copy.reset}
          </button>
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className={styles.noMatch}>{copy.empty}</p>
      ) : (
        <div className={offerStyles.aggregateRail} data-layout={layout}>
          {shown.map((entry) => (
            <PlatformOfferCard key={entry.key} {...entry.card} />
          ))}
        </div>
      )}
    </div>
  );
}

export { catalogFilterCopy };
