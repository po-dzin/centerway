import { getIsoDateInTimeZone, localMidnightUtcIso, shiftIsoDate } from "@/lib/analytics/helpers";

/**
 * The one date range every analytics read is asked for.
 *
 * The dashboard route and the dosha route each parsed `?from&to` into the
 * same four fields with the same clamping — the dosha copy carried its own
 * four date helpers to do it. One parser, one time zone, one shape.
 */
export const ANALYTICS_TZ = "Europe/Kyiv";

export type DateRange = {
    from: string;
    to: string;
    fromTs: string;
    toExclusiveTs: string;
};

export function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toDateRange(searchParams: URLSearchParams): DateRange {
    const todayIso = getIsoDateInTimeZone(new Date(), ANALYTICS_TZ);
    const defaultTo = todayIso;
    const defaultFrom = shiftIsoDate(todayIso, -29);

    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");

    const from = rawFrom && isIsoDate(rawFrom) ? rawFrom : defaultFrom;
    const to = rawTo && isIsoDate(rawTo) ? rawTo : defaultTo;
    const normalizedFrom = from <= to ? from : to;
    const normalizedTo = to >= from ? to : from;
    const clampedTo = normalizedTo > todayIso ? todayIso : normalizedTo;
    const clampedFrom = normalizedFrom > clampedTo ? clampedTo : normalizedFrom;

    const fromTs = localMidnightUtcIso(clampedFrom, ANALYTICS_TZ);
    const toExclusiveTs = localMidnightUtcIso(shiftIsoDate(clampedTo, 1), ANALYTICS_TZ);

    return {
        from: clampedFrom,
        to: clampedTo,
        fromTs,
        toExclusiveTs,
    };
}
