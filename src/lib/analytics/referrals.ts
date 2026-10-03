import { unstable_cache } from "next/cache";

import { loadProductIdentity } from "@/lib/analytics/productIdentity";
import type { DateRange } from "@/lib/analytics/range";
import { adminClient } from "@/lib/auth/adminClient";

/**
 * WHO BROUGHT WHOM (2026-10-03).
 *
 * `?ref=` has been written since 2026-09-19 — on the enrollment for a free
 * seat, on the order when somebody pays (see src/lib/referral/ref.ts) — and
 * nothing read it back. This is the read: per tag, how many people came, how
 * many of them paid, and what they paid, with the people themselves listed so
 * the owner can thank a friend by name rather than by number.
 *
 * ONE PERSON, ONE COURSE, ONE ROW. A paying friend of Olena's leaves the tag
 * twice: on the order, and again on the enrollment the order materializes on
 * first open. Counting rows would report that person as two. They are folded
 * on (tag, person, course), and the fold is the part of this file that can be
 * wrong, so it is the pure half below and the database is only its feeder.
 *
 * The fold is per tag, not global. The cookie is first-touch and both rows read
 * the same cookie, so the two tags agree in practice; when they do not (an
 * operator typed a tag on a manual grant), the person shows under both, which
 * is visible, rather than silently under whichever we guessed was right.
 */

/** Statuses that mean the money arrived — the same pair the dashboard counts. */
const PAID_STATUSES = ["paid", "completed"] as const;
/** What an order with no currency was charged in; the dashboard assumes the same. */
const DEFAULT_CURRENCY = "UAH";

export type ReferralEnrollmentRow = {
  auth_user_id: string;
  course_id: string;
  ref: string | null;
  source: string | null;
  order_ref: string | null;
  created_at: string;
};

export type ReferralOrderRow = {
  order_ref: string;
  ref: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
  customer_id: string | null;
  product_code: string | null;
};

export type ReferralLookups = {
  /** auth_user_id → the account's email (platform_users). */
  accountEmail: Map<string, string | null>;
  /** customers.id → its linked account and email. */
  customers: Map<string, { authUserId: string | null; email: string | null }>;
  /** lms_courses.id → its report key (`course:<slug>`) and title. */
  courses: Map<string, { key: string; title: string | null }>;
  /** order_ref → the enrollment the order materialized, whatever tag it carries. */
  orderEnrollment: Map<string, { authUserId: string; courseId: string }>;
  /** A product code's report key and title, for an order nobody has opened yet. */
  product: (code: string | null) => { key: string; title: string | null };
};

export type ReferralPerson = {
  email: string | null;
  course_key: string;
  course_title: string | null;
  /** The earliest of the person's rows for this course. */
  at: string;
  paid: boolean;
  order_ref: string | null;
};

export type ReferralRevenue = { currency: string; amount: number };

export type ReferralTag = {
  ref: string;
  people: number;
  paid_people: number;
  free_people: number;
  paid_orders: number;
  revenue: ReferralRevenue[];
  first_at: string;
  last_at: string;
  people_list: ReferralPerson[];
};

export type ReferralReport = {
  totals: {
    tags: number;
    people: number;
    paid_people: number;
    free_people: number;
    paid_orders: number;
    revenue: ReferralRevenue[];
  };
  tags: ReferralTag[];
};

function isPaidStatus(status: string | null | undefined): boolean {
  return (PAID_STATUSES as readonly string[]).includes(String(status ?? "").toLowerCase());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function revenueList(byCurrency: Map<string, number>): ReferralRevenue[] {
  return [...byCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));
}

function addRevenue(target: Map<string, number>, currency: string | null, amount: number | null) {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const code = currency?.trim().toUpperCase() || DEFAULT_CURRENCY;
  target.set(code, (target.get(code) ?? 0) + value);
}

type TagAcc = {
  ref: string;
  entries: Map<string, ReferralPerson>;
  orderRefs: Set<string>;
  revenue: Map<string, number>;
  first: string;
  last: string;
};

/**
 * The pure fold. Orders are expected to be paid already — an unpaid order
 * brought nobody in — but a stray one is skipped here too rather than trusted.
 */
export function aggregateReferrals(
  enrollments: ReferralEnrollmentRow[],
  orders: ReferralOrderRow[],
  lookups: ReferralLookups,
): ReferralReport {
  // An order's buyer is known by account when anything links them to one, and
  // by email only when nothing does — so a buyer who later signed in is the
  // same person as the enrollment they opened, not a second one.
  const accountByEmail = new Map<string, string>();
  for (const [authUserId, email] of lookups.accountEmail) {
    if (email) accountByEmail.set(email.trim().toLowerCase(), authUserId);
  }

  const tags = new Map<string, TagAcc>();
  const tagFor = (ref: string, at: string): TagAcc => {
    let acc = tags.get(ref);
    if (!acc) {
      acc = { ref, entries: new Map(), orderRefs: new Set(), revenue: new Map(), first: at, last: at };
      tags.set(ref, acc);
    }
    if (at < acc.first) acc.first = at;
    if (at > acc.last) acc.last = at;
    return acc;
  };

  const touch = (acc: TagAcc, personKey: string, next: ReferralPerson) => {
    const key = `${personKey}\u0000${next.course_key}`;
    const existing = acc.entries.get(key);
    if (!existing) {
      acc.entries.set(key, next);
      return;
    }
    // Paid wins over free and an order number over none: the two rows are one
    // person, and the merged row should say the most either of them knew.
    existing.paid = existing.paid || next.paid;
    existing.order_ref = existing.order_ref ?? next.order_ref;
    existing.email = existing.email ?? next.email;
    existing.course_title = existing.course_title ?? next.course_title;
    if (next.at < existing.at) existing.at = next.at;
  };

  const courseOf = (courseId: string) => lookups.courses.get(courseId) ?? { key: `course-id:${courseId}`, title: null };

  for (const order of orders) {
    if (!order.ref || !isPaidStatus(order.status)) continue;
    const acc = tagFor(order.ref, order.created_at);

    if (!acc.orderRefs.has(order.order_ref)) {
      acc.orderRefs.add(order.order_ref);
      addRevenue(acc.revenue, order.currency, order.amount);
    }

    const linked = lookups.orderEnrollment.get(order.order_ref);
    const customer = order.customer_id ? lookups.customers.get(order.customer_id) : undefined;
    const customerEmail = customer?.email?.trim().toLowerCase() || null;
    const authUserId =
      linked?.authUserId ?? customer?.authUserId ?? (customerEmail ? accountByEmail.get(customerEmail) : undefined);
    const personKey = authUserId
      ? `account:${authUserId}`
      : customerEmail
        ? `email:${customerEmail}`
        : `order:${order.order_ref}`;
    const course = linked ? courseOf(linked.courseId) : lookups.product(order.product_code);

    touch(acc, personKey, {
      email: (authUserId ? lookups.accountEmail.get(authUserId) : null) ?? customer?.email ?? null,
      course_key: course.key,
      course_title: course.title,
      at: order.created_at,
      paid: true,
      order_ref: order.order_ref,
    });
  }

  for (const enrollment of enrollments) {
    if (!enrollment.ref) continue;
    const acc = tagFor(enrollment.ref, enrollment.created_at);
    const course = courseOf(enrollment.course_id);
    touch(acc, `account:${enrollment.auth_user_id}`, {
      email: lookups.accountEmail.get(enrollment.auth_user_id) ?? null,
      course_key: course.key,
      course_title: course.title,
      at: enrollment.created_at,
      // An enrollment made by an order is a paid seat even when the order
      // itself fell outside the period or carried no tag of its own.
      paid: enrollment.source === "order",
      order_ref: enrollment.order_ref,
    });
  }

  const totalRevenue = new Map<string, number>();
  const result: ReferralTag[] = [...tags.values()].map((acc) => {
    const peopleList = [...acc.entries.values()].sort((a, b) => b.at.localeCompare(a.at));
    const paidPeople = peopleList.filter((person) => person.paid).length;
    for (const [currency, amount] of acc.revenue) {
      totalRevenue.set(currency, (totalRevenue.get(currency) ?? 0) + amount);
    }
    return {
      ref: acc.ref,
      people: peopleList.length,
      paid_people: paidPeople,
      free_people: peopleList.length - paidPeople,
      paid_orders: acc.orderRefs.size,
      revenue: revenueList(acc.revenue),
      first_at: acc.first,
      last_at: acc.last,
      people_list: peopleList,
    };
  });

  result.sort((a, b) => b.people - a.people || b.paid_orders - a.paid_orders || a.ref.localeCompare(b.ref));

  return {
    totals: {
      tags: result.length,
      people: result.reduce((sum, tag) => sum + tag.people, 0),
      paid_people: result.reduce((sum, tag) => sum + tag.paid_people, 0),
      free_people: result.reduce((sum, tag) => sum + tag.free_people, 0),
      paid_orders: result.reduce((sum, tag) => sum + tag.paid_orders, 0),
      revenue: revenueList(totalRevenue),
    },
    tags: result,
  };
}

const CHUNK = 200;

async function inChunks<T>(values: string[], read: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += CHUNK) {
    out.push(...(await read(values.slice(i, i + CHUNK))));
  }
  return out;
}

/** The database half: reads the tagged rows of the period and everything needed to name them. */
export async function computeReferralAnalytics(range: DateRange) {
  const db = adminClient();

  const [enrollmentRead, orderRead] = await Promise.all([
    db
      .from("lms_enrollments")
      .select("auth_user_id, course_id, ref, source, order_ref, created_at")
      .not("ref", "is", null)
      .gte("created_at", range.fromTs)
      .lt("created_at", range.toExclusiveTs)
      .limit(20000),
    db
      .from("orders")
      .select("order_ref, ref, status, amount, currency, created_at, customer_id, product_code")
      .not("ref", "is", null)
      .in("status", [...PAID_STATUSES])
      .gte("created_at", range.fromTs)
      .lt("created_at", range.toExclusiveTs)
      .limit(20000),
  ]);
  if (enrollmentRead.error) throw new Error(enrollmentRead.error.message);
  if (orderRead.error) throw new Error(orderRead.error.message);

  const enrollments = (enrollmentRead.data ?? []) as ReferralEnrollmentRow[];
  const orders = (orderRead.data ?? []) as ReferralOrderRow[];

  // The enrollment an order became is read whatever its own tag, because it is
  // the only row that knows the buyer's account and the course for certain.
  const orderRefs = [...new Set(orders.map((order) => order.order_ref))];
  const linkedEnrollments = await inChunks(orderRefs, async (chunk) => {
    const { data, error } = await db
      .from("lms_enrollments")
      .select("auth_user_id, course_id, order_ref")
      .in("order_ref", chunk);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const orderEnrollment = new Map<string, { authUserId: string; courseId: string }>();
  for (const row of linkedEnrollments) {
    if (row.order_ref) orderEnrollment.set(row.order_ref, { authUserId: row.auth_user_id, courseId: row.course_id });
  }

  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter((id): id is string => !!id))];
  const customerRows = await inChunks(customerIds, async (chunk) => {
    const { data, error } = await db.from("customers").select("id, auth_user_id, email").in("id", chunk);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const customers = new Map(
    customerRows.map((row) => [row.id, { authUserId: row.auth_user_id ?? null, email: row.email ?? null }]),
  );

  // platform_users is where the admin reads a person's email (accountsByIds);
  // an account that never signed in has no row there and falls back to the
  // customer's email in the fold.
  const accountIds = [
    ...new Set([
      ...enrollments.map((row) => row.auth_user_id),
      ...[...orderEnrollment.values()].map((row) => row.authUserId),
      ...[...customers.values()].map((row) => row.authUserId).filter((id): id is string => !!id),
    ]),
  ];
  const accountRows = await inChunks(accountIds, async (chunk) => {
    const { data, error } = await db.from("platform_users").select("auth_user_id, email").in("auth_user_id", chunk);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const accountEmail = new Map(accountRows.map((row) => [row.auth_user_id, row.email ?? null]));

  const [{ data: courseRows, error: courseError }, identity] = await Promise.all([
    db.from("lms_courses").select("id, slug, title"),
    loadProductIdentity(db),
  ]);
  if (courseError) throw new Error(courseError.message);
  const courses = new Map(
    (courseRows ?? []).map((row) => [row.id, { key: `course:${row.slug}`, title: row.title?.trim() || row.slug }]),
  );

  const report = aggregateReferrals(enrollments, orders, {
    accountEmail,
    customers,
    courses,
    orderEnrollment,
    product: (code) => ({ key: identity.key(code), title: identity.title(code) }),
  });

  return { period: { from: range.from, to: range.to }, ...report };
}

export function getCachedReferralAnalytics(range: DateRange) {
  return unstable_cache(
    async () => computeReferralAnalytics(range),
    ["admin-referral-analytics-v1", range.from, range.to],
    { revalidate: 120 },
  )();
}

export type ReferralAnalyticsPayload = Awaited<ReturnType<typeof computeReferralAnalytics>>;
