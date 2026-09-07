/**
 * Shapes the catalogue screen and its API agree on.
 *
 * Apart from `catalog.ts` for the same reason `accessTypes.ts` is apart from
 * `access.ts`: that module imports the service-role client, and the screen is a
 * client component that must be able to name these types without dragging the
 * server module into the browser bundle.
 */

export type CatalogOffer = {
    code: string;
    amount: number;
    listAmount: number | null;
    currency: string;
    pixelContentName: string;
    accessDays: number | null;
    accessLifetime: boolean;
    active: boolean;
    updatedAt: string | null;
};

export type SaleBlocker =
    /**
     * The storefront cannot BUILD this course out of its own rows.
     *
     * The one blocker not derived from a column: it is the answer the shelf
     * itself gives. `listLiveCourses` skips any course `courseFromRows`
     * refuses, with nothing but a server log to show for it — so on
     * 2026-09-01 a tightened title ceiling took a published, listed, priced
     * course off the catalogue while this screen went on calling it «у
     * продажу». A screen that claims a course is on sale has to be reading
     * the same shelf a buyer does.
     */
    | "not_renderable"
    | "not_published"
    | "not_approved"
    | "hidden"
    | "no_offer"
    | "offer_withdrawn"
    | "no_access_rule";

export type CatalogRow = {
    courseId: string;
    slug: string;
    /**
     * The address the offer is SOLD at, which is not always the slug — `short`
     * is sold as /programs/reboot. Carried so the screen can link the page a
     * buyer would land on, rather than one built from the row name.
     */
    programSlug: string;
    title: string;
    status: string;
    reviewStatus: string;
    visibility: "hidden" | "unlisted" | "listed";
    hasPendingRevision: boolean;
    pendingReviewStatus?: string | null;
    /**
     * Чем ожидающая ревизия отличается от того, что уже стоит на полке.
     *
     * Числами, а не текстом: рецензенту нужен ответ на «во что смотреть», а
     * подробности он видит в самом курсе. `null` — разницу не удалось
     * посчитать; это не повод убирать курс из очереди.
     */
    pendingDiff?: PendingDiff | null;
    authorEmail: string | null;
    learners: number;
    updatedAt: string;
    offer: CatalogOffer | null;
    blockers: SaleBlocker[];
};

/**
 * The terms the screen offers, in days.
 *
 * A list rather than a free number field: these are the windows the business
 * actually sells, and picking from them makes the common case one click and
 * the typo impossible. "Forever" is a separate option in the same control, so
 * an unstated term cannot be spelled as an empty box.
 */
export const ACCESS_TERM_PRESETS = [7, 14, 30, 60, 90, 180, 365] as const;

/** Сводка изменений ожидающей ревизии. Считается по запросу и не хранится. */
export type PendingDiff = {
    /**
     * Тронут ли обязательный блок «межі та застереження».
     *
     * Отдельным флагом, а не строкой в общем счёте: правка именно его после
     * одобрения — то единственное, ради обнаружения чего журнал заводили.
     */
    boundaryTouched: boolean;
    fields: number;
    modules: number;
    lessonsAdded: number;
    lessonsRemoved: number;
    lessonsChanged: number;
};
