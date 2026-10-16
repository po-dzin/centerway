"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/ToastProvider";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { plural } from "@/lib/plural";
import { BuilderFailureNotice, BuilderShell } from "./BuilderShell";
import { BuilderWorkshopRail } from "./BuilderWorkshopRail";
import {
  createAuthorLink,
  exportAuthorLedger,
  getAuthorLedger,
  type BuilderFailure,
  type LedgerLinkView,
  type LedgerPeriod,
  type LedgerStatus,
  type LedgerView,
} from "./builderClient";
import styles from "./Builder.module.css";

/**
 * «Облік» — what the author's work earned, where it came from, what is already theirs.
 *
 * SEMANTIC PREFLIGHT (2026-10-14; RAverse canon not read — unreachable from the
 * cloud session, docs/CANON.md and docs/platform_agent_preflight.md used).
 * - semantic_role: прогрес (primary), обмін (secondary) — «Дашборд / карта
 *   прогресу», density Compact, the overview's sibling.
 * - user_question: «Скільки я заробив, звідки прийшли люди, що вже на моєму ФОП,
 *   і яке посилання поставити під наступний допис?»
 * - token_source: global DS through `Builder.module.css` overview recipes —
 *   panel, tiles, table, field, input, headPrimaryAction. No new palette,
 *   radius, shadow or type scale.
 * - content_source: `order_shares` + `orders` (date, ref) + `experiences`
 *   (title) + `author_links`, through /api/lms/authoring/ledger. No buyer
 *   identity is read.
 * - route_boundary: `/build/oblik` on the personal host; the admin panel and
 *   funnels are untouched.
 * - selection_family: period switch and copy are `ink` text controls
 *   (`InteractionInkLabel variant="link"`); the create button is the shared
 *   primary. Boundary role: structural for panels and tiles, none for tables.
 *
 * Same five-block discipline as the overview: summary tiles with their
 * comparison, the sources table, the link form beside the author's links, the
 * recent orders, and the month's file for the bookkeeper. A section that did
 * not load says so; it never renders as zero.
 */

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; view: LedgerView };

const PERIODS: { key: LedgerPeriod; label: string }[] = [
  { key: "7", label: "7 днів" },
  { key: "30", label: "30 днів" },
  { key: "all", label: "Увесь час" },
];

const STATUS_WORDS: Record<LedgerStatus, string> = {
  accrued: "чекає виплати",
  split_at_source: "на вашому ФОП",
  paid_out: "виплачено",
  reversed: "повернення",
  clawback: "повернення після виплати",
};

const CHANNELS = ["Instagram", "Telegram", "Threads", "Facebook", "YouTube", "Ефір", "Розсилка"];

const money = (value: number) => `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value)} ₴`;
const day = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }) : "—";
const ordersWord = (count: number) => `${count} ${plural(count, "оплата", "оплати", "оплат")}`;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function BuilderLedger() {
  const toast = useToast();
  const [period, setPeriod] = useState<LedgerPeriod>("30");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getAuthorLedger(period);
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", view: result.data }
          : { status: "failed", failure: result.failure, detail: result.detail },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const rail = <BuilderWorkshopRail current="ledger" />;

  if (state.status === "loading") {
    return (
      <BuilderShell aside={rail}>
        <PlatformLoadingState label="Майстерня" title="Збираємо ваш облік…" detail="Частки, джерела й посилання." />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell aside={rail}>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} scope="shelf" />
      </BuilderShell>
    );
  }

  const { view } = state;

  async function saveMonth() {
    const month = currentMonth();
    const blob = await exportAuthorLedger(month);
    if (!blob) {
      toast.error("Не вдалося завантажити облік за місяць.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oblik-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Збережено oblik-${month}.csv`);
  }

  return (
    <BuilderShell aside={rail}>
      <PlatformPageHead
        label="Майстерня"
        title="Облік"
        lead="Ваша частка, звідки прийшли люди і що вже на вашому ФОП."
        actions={
          view.author ? (
            <button
              type="button"
              className={styles.overviewTextAction}
              data-cw-ink-control
              onClick={() => void saveMonth()}
            >
              <InteractionInkLabel variant="link">Файл за місяць</InteractionInkLabel>
            </button>
          ) : null
        }
      />

      {!view.author || !view.totals ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Облік з&apos;являється разом із профілем автора</h2>
          <p className={styles.panelText}>
            Коли ваш профіль автора буде прив&apos;язаний до курсу, тут з&apos;являться ваші частки, джерела оплат і
            посилання для дописів.
          </p>
        </section>
      ) : (
        <div className={styles.overviewSections}>
          <div className={styles.overviewSectionHead} role="group" aria-label="Період">
            {PERIODS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={styles.overviewTextAction}
                data-cw-ink-control
                aria-pressed={period === entry.key}
                onClick={() => setPeriod(entry.key)}
              >
                <InteractionInkLabel variant="link">{entry.label}</InteractionInkLabel>
              </button>
            ))}
          </div>

          <dl className={styles.overviewTiles}>
            <Tile label="Ваша частка" value={money(view.totals.share)} note={`з ${money(view.totals.gross)} оплат`} />
            <Tile
              label="Оплати"
              value={String(view.totals.orders)}
              note={`${view.totals.ownOrders} з ваших каналів, ${view.totals.platformOrders} від платформи`}
            />
            <Tile
              label="Уже ваші"
              value={money(view.totals.received)}
              note={
                view.totals.awaiting > 0
                  ? `${money(view.totals.awaiting)} ще чекають виплати`
                  : "нічого не чекає виплати"
              }
            />
            <Tile
              label="Повернення"
              value={String(view.totals.refunds)}
              note={view.totals.refunds > 0 ? `−${money(view.totals.refunded)} з вашої частки` : "повернень немає"}
            />
          </dl>

          <section className={styles.panel}>
            <div className={styles.overviewSectionHead}>
              <h2 className={styles.panelTitle}>Звідки прийшли оплати</h2>
            </div>
            <p className={styles.overviewSectionLead}>
              Кожне ваше посилання рахується окремо. Людину зараховуємо за першим посиланням, яким вона прийшла,
              протягом 90 днів.
            </p>
            {view.sources && view.sources.length > 0 ? (
              <div className={styles.overviewTableScroll}>
                <table className={styles.overviewTable} data-table="ledger-sources">
                  <thead>
                    <tr>
                      <th scope="col">Джерело</th>
                      <th scope="col" data-numeric>
                        Оплати
                      </th>
                      <th scope="col" data-numeric>
                        Ваша частка
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.sources.map((line) => (
                      <tr key={line.key}>
                        <td>
                          <span className={styles.overviewCourseCell}>
                            <span>{line.label}</span>
                            <span className={styles.overviewItemNote}>
                              {line.source === "platform" ? "каталог, розсилки, інші автори" : line.key}
                            </span>
                          </span>
                        </td>
                        <td data-numeric data-label="Оплати">
                          {line.orders}
                        </td>
                        <td data-numeric data-label="Ваша частка">
                          {money(line.share)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.panelText}>За цей період оплат ще не було.</p>
            )}
          </section>

          <LinkPanel view={view} />

          <section className={styles.panel}>
            <div className={styles.overviewSectionHead}>
              <h2 className={styles.panelTitle}>Оплати</h2>
            </div>
            {view.rows && view.rows.length > 0 ? (
              <>
                <div className={styles.overviewTableScroll}>
                  <table className={styles.overviewTable} data-table="ledger-orders">
                    <thead>
                      <tr>
                        <th scope="col">Дата</th>
                        <th scope="col">Курс</th>
                        <th scope="col">Джерело</th>
                        <th scope="col" data-numeric>
                          Сума
                        </th>
                        <th scope="col" data-numeric>
                          Ваша частка
                        </th>
                        <th scope="col">Стан</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.rows.map((row) => {
                        const standing = row.status !== "reversed" && row.status !== "clawback";
                        return (
                          <tr key={row.orderRef}>
                            <td className={styles.overviewTableWhen}>{day(row.createdAt)}</td>
                            <td>{row.courseTitle ?? "—"}</td>
                            <td data-muted>
                              {row.source === "platform"
                                ? "CenterWay"
                                : (view.links?.find((link) => link.tag === row.ref)?.label ??
                                  row.ref ??
                                  "ваше посилання")}
                            </td>
                            <td data-numeric data-label="Сума">
                              {money(row.baseAmount)}
                            </td>
                            <td data-numeric data-label="Ваша частка">
                              {standing ? money(row.amount) : `−${money(row.amount)}`}
                            </td>
                            <td data-muted>{STATUS_WORDS[row.status]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(view.rowsTotal ?? 0) > view.rows.length ? (
                  <p className={styles.overviewSectionLead}>
                    Показано останні {view.rows.length} з {view.rowsTotal}. Повний список у файлі за місяць.
                  </p>
                ) : null}
              </>
            ) : (
              <p className={styles.panelText}>За цей період оплат ще не було.</p>
            )}
          </section>
        </div>
      )}
    </BuilderShell>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={styles.overviewTile}>
      <dt className={styles.overviewTileLabel}>{label}</dt>
      <dd className={styles.overviewTileValue}>{value}</dd>
      <dd className={styles.overviewTileNote}>{note}</dd>
    </div>
  );
}

/** The form that makes a link for one post, and the author's links with what each sold. */
function LinkPanel({ view }: { view: LedgerView }) {
  const toast = useToast();
  const [links, setLinks] = useState<LedgerLinkView[]>(view.links ?? []);
  const [label, setLabel] = useState("");
  const [channel, setChannel] = useState(CHANNELS[0]!);
  const [target, setTarget] = useState(view.destinations?.[1]?.path ?? view.destinations?.[0]?.path ?? "/");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const origin = view.origin ?? "";

  const urlFor = (link: Pick<LedgerLinkView, "tag" | "targetPath">) =>
    `${origin}${link.targetPath}${link.targetPath.includes("?") ? "&" : "?"}ref=${link.tag}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Посилання скопійовано.");
    } catch {
      toast.error("Не вдалося скопіювати. Виділіть посилання вручну.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !label.trim()) return;
    setBusy(true);
    const result = await createAuthorLink({ label: label.trim(), channel, targetPath: target });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.detail ?? "Не вдалося створити посилання.");
      return;
    }
    setLinks((current) => [result.data.link, ...current]);
    setFresh(result.data.link.tag);
    setLabel("");
    void copy(urlFor(result.data.link));
  }

  return (
    <section className={styles.panel}>
      <div className={styles.overviewSectionHead}>
        <h2 className={styles.panelTitle}>Посилання для дописів</h2>
      </div>
      <p className={styles.overviewSectionLead}>
        Під кожен допис, сторіс чи ефір окреме посилання. Оплати з ваших посилань приносять вам вашу частку з власних
        каналів.
      </p>
      <form className={styles.overviewSections} onSubmit={(event) => void submit(event)}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Назва допису</span>
          <input
            id="ledger-link-label"
            className={styles.input}
            value={label}
            maxLength={120}
            placeholder="Рілс про вечірній ритуал"
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Де публікуєте</span>
          <select
            id="ledger-link-channel"
            className={`${styles.input} ${styles.select}`}
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            {CHANNELS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Куди веде</span>
          <select
            id="ledger-link-target"
            className={`${styles.input} ${styles.select}`}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {(view.destinations ?? []).map((destination) => (
              <option key={destination.path} value={destination.path}>
                {destination.label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button type="submit" className={styles.headPrimaryAction} disabled={busy || !label.trim()}>
            {busy ? "Створюємо…" : "Створити й скопіювати"}
          </button>
        </div>
      </form>

      {links.length > 0 ? (
        <ul className={styles.overviewList}>
          {links.map((link) => (
            <li key={link.tag} className={styles.overviewItem}>
              <span>
                {link.label}
                {link.channel ? <span className={styles.overviewItemNote}> · {link.channel}</span> : null}
              </span>
              <span className={styles.overviewItemState}>
                <span className={styles.overviewItemLine}>
                  {link.orders > 0
                    ? ordersWord(link.orders)
                    : fresh === link.tag
                      ? "щойно створено"
                      : "оплат поки немає"}
                </span>
                <button
                  type="button"
                  className={styles.overviewTextAction}
                  data-cw-ink-control
                  title={urlFor(link)}
                  onClick={() => void copy(urlFor(link))}
                >
                  <InteractionInkLabel variant="link">Скопіювати</InteractionInkLabel>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.panelText}>Посилань поки немає. Створіть перше під найближчий допис.</p>
      )}
    </section>
  );
}
