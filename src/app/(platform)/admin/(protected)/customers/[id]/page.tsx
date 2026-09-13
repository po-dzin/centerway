"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import profileStyles from "@/components/admin/AdminProfile.module.css";
import pageStyles from "@/components/admin/AdminPage.module.css";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";

interface Customer {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tags: string[];
  notes: string | null;
  tg_id: string | null;
  google_id: string | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelineItem {
  ts: string;
  type: "order" | "event";
  label: string;
  sub: string | null;
  id: string;
  ref?: string;
  status?: string;
  product_code?: string | null;
}

interface CustomerEnrollment {
  id: string;
  course_slug: string | null;
  course_title: string | null;
  source: string;
  status: string | null;
  order_ref: string | null;
  expires_at: string | null;
  expired: boolean;
  last_activity_at: string | null;
  started: boolean;
  created_at: string;
}

interface CustomerOrder {
  id: string;
  order_ref: string;
  product_code: string | null;
  product_title: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  created_at: string;
}

interface CustomerEvent {
  id: string;
  type: string;
  order_ref: string | null;
  payload: unknown;
  created_at: string;
}

interface ProfileData {
  customer: Customer;
  enrollments: CustomerEnrollment[];
  orders: CustomerOrder[];
  events: CustomerEvent[];
  timeline: TimelineItem[];
}

/* The timeline marker's colour, by what kind of thing happened. Not the badge
   classes: those are capsules, and a marker is a square. */
const typeMark: Record<string, string | undefined> = {
  order: profileStyles.eventMarkOrder,
  event: profileStyles.eventMarkEvent,
};

const typeIcons: Record<string, ReactNode> = {
  order: <Icon name="price" size={16} />,
  event: <Icon name="chart" size={16} />,
};

function Avatar({ name, url }: { name?: string | null; url?: string | null }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return url ? (
    <Image
      src={url}
      alt={name ?? "avatar"}
      width={56}
      height={56}
      unoptimized
      className={profileStyles.avatar}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className={profileStyles.avatarFallback}>{initial}</div>
  );
}

const orderStatusColor: Record<string, string> = {
  paid: "cw-status-success-text",
  pending: "cw-status-pending-text",
  created: "cw-muted",
  refunded: "cw-status-failed-text",
};

function ContactRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className={profileStyles.contact}>
      <span className={profileStyles.contactKindTag}>{label}</span>
      <p className={profileStyles.contactValue} title={value}>
        {value}
      </p>
      {badge && <Icon className={`cw-status-success-text ${profileStyles.contactMark}`} name="check" size={16} />}
    </div>
  );
}

export default function CustomerProfilePage() {
  const { lang, t } = useI18n();
  const isUk = lang === "uk";
  const locale = getAdminLocale(lang);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await authorizedFetch(`/api/admin/customers/${id}`);
        if (res.status === 404) {
          router.replace("/admin/customers");
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        setProfile(await res.json());
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <div className={profileStyles.loading}>
        <div className={profileStyles.skeletonLine} />
        <div className={profileStyles.skeletonCard} />
        <div className={profileStyles.skeletonBody} />
      </div>
    );
  }

  if (error || !profile) {
    return <AdminErrorState title={t("common_error")} message={error ?? t("customers_not_found")} />;
  }

  const { customer, orders, timeline } = profile;
  const enrollments = profile.enrollments ?? [];
  const displayName = customer.display_name ?? customer.email ?? customer.phone ?? t("customers_no_name");
  const ordersCountLabel = (() => {
    const value = orders.length;
    if (!isUk) return `${value} ${t("orders_count_en")}`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return `${value} ${t("orders_count_one")}`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${t("orders_count_few")}`;
    return `${value} ${t("orders_count_many")}`;
  })();
  const orderStatusLabel: Record<string, string> = {
    paid: t("orders_status_paid"),
    created: t("orders_status_created"),
    pending: t("orders_status_pending"),
    refunded: t("orders_status_refunded"),
  };

  // Check if we have any contacts to show
  const hasContacts = customer.email || customer.phone || customer.tg_id || customer.google_id || customer.auth_user_id;

  return (
    <div className={pageStyles.page}>
      <nav className={profileStyles.crumbs}>
        <Link href="/admin/customers" className={profileStyles.crumbLink}>
          {t("customers_title")}
        </Link>
        <span>/</span>
        <span className={profileStyles.crumbCurrent}>{displayName}</span>
      </nav>

      {/* Profile card */}
      <div className={surfaces.plate}>
        <div className={profileStyles.head}>
          <Avatar name={displayName} url={customer.avatar_url} />
          <div className={profileStyles.identity}>
            <h2 className={profileStyles.name}>{displayName}</h2>
            <p className={profileStyles.id}>{customer.id}</p>

            {customer.tags?.length > 0 && (
              <div className={profileStyles.tags}>
                {customer.tags.map((tag) => (
                  <span key={tag} className={profileStyles.tagChip}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {customer.notes && <p className={profileStyles.notes}>{customer.notes}</p>}
          </div>
          <div className={profileStyles.facts}>
            <p className={profileStyles.factLine}>{t("customers_profile_created")}</p>
            <p className={profileStyles.factStrong}>
              {new Date(customer.created_at).toLocaleDateString(locale, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className={profileStyles.factGap}>{ordersCountLabel}</p>
          </div>
        </div>
      </div>

      <div className={profileStyles.layout}>
        <div className={profileStyles.side}>
          <div className={profileStyles.group}>
            <h3 className={profileStyles.groupTitle}>{t("customers_profile_contacts")}</h3>
            {!hasContacts ? (
              <p className={profileStyles.note}>{t("customers_profile_contacts_empty")}</p>
            ) : (
              <div className={profileStyles.group}>
                {customer.email && (
                  <ContactRow label={t("customers_contact_email")} value={customer.email} badge={true} />
                )}
                {customer.phone && (
                  <ContactRow label={t("customers_contact_phone")} value={customer.phone} badge={true} />
                )}
                {customer.tg_id && <ContactRow label={t("customers_contact_telegram")} value={customer.tg_id} />}
                {customer.google_id && <ContactRow label={t("customers_contact_google")} value={customer.google_id} />}
                {customer.auth_user_id && (
                  <ContactRow label={t("customers_contact_auth_user")} value={customer.auth_user_id} />
                )}
              </div>
            )}
          </div>

          {/* WHAT THEY CAN OPEN. Above the orders on purpose: an order is
              what happened, access is what is true now, and the operator
              opening this card is almost always asking the second question. */}
          {enrollments.length > 0 && (
            <div className={profileStyles.group}>
              <h3 className={profileStyles.groupTitle}>{t("customers_profile_access")}</h3>
              {enrollments.map((e) => (
                <div key={e.id} className={surfaces.tile}>
                  <p className={profileStyles.tileTitle}>
                    {e.course_title ?? e.course_slug ?? t("customers_profile_access_unknown_course")}
                  </p>
                  <div className={profileStyles.tileMeta}>
                    <span className={e.started ? "cw-status-success-badge" : profileStyles.stateMuted}>
                      {e.started ? t("access_status_in_progress") : t("access_status_not_started")}
                    </span>
                    {e.expires_at && (
                      <span className={e.expired ? "cw-status-failed-badge" : profileStyles.note}>
                        {e.expired ? t("customers_profile_access_expired") : t("customers_profile_access_until")}{" "}
                        {new Date(e.expires_at).toLocaleDateString(locale, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  {e.last_activity_at && (
                    <p className={profileStyles.tileFoot}>
                      {t("customers_profile_access_last_seen")}{" "}
                      {new Date(e.last_activity_at).toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* A buyer who has never signed in has no account to hang access on.
              That is an ordinary state, not a fault, and saying so beats an
              empty column. */}
          {enrollments.length === 0 && !customer.auth_user_id && orders.some((o) => o.status === "paid") && (
            <p className={profileStyles.note}>{t("customers_profile_access_no_account")}</p>
          )}

          {/* Orders summary */}
          {orders.length > 0 && (
            <div className={profileStyles.group}>
              <h3 className={profileStyles.groupTitle}>{t("orders_title")}</h3>
              {orders.map((o) => (
                <div key={o.id} className={surfaces.tile}>
                  <div className={profileStyles.orderHead}>
                    <span className={profileStyles.orderRef}>{o.order_ref}</span>
                    <span className={`${profileStyles.orderState} ${orderStatusColor[o.status] ?? "cw-muted"}`}>
                      {orderStatusLabel[o.status] ?? o.status}
                    </span>
                  </div>
                  {o.amount && (
                    <p className={profileStyles.orderAmount}>
                      {o.amount} <span className={profileStyles.orderCurrency}>{o.currency}</span>
                    </p>
                  )}
                  <p className={profileStyles.tileFoot}>{o.product_title ?? o.product_code}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className={profileStyles.main}>
          <h3 className={profileStyles.groupTitle}>
            {t("customers_profile_timeline")} <span className={profileStyles.groupCount}>({timeline.length})</span>
          </h3>

          {timeline.length === 0 ? (
            <p className={profileStyles.noteSpaced}>{t("customers_profile_no_events")}</p>
          ) : (
            <div className={profileStyles.timeline}>
              {timeline.map((item, i) => (
                <div key={`${item.id}-${i}`}>
                  <div className={profileStyles.event}>
                    <div className={typeMark[item.type] ?? profileStyles.eventMark}>{typeIcons[item.type]}</div>
                    <div className={profileStyles.eventBody}>
                      {/* The server sends facts; the sentence is written here,
                          in the reader's language. It used to arrive
                          pre-assembled as a Russian string. */}
                      <p className={profileStyles.eventTitle}>
                        {item.type === "order" ? `${t("customers_profile_timeline_order")}: ${item.label}` : item.label}
                      </p>
                      <div className={profileStyles.eventMeta}>
                        {item.type === "order" && item.status && (
                          <span
                            className={`${profileStyles.orderState} ${orderStatusColor[item.status] ?? "cw-muted"}`}
                          >
                            {orderStatusLabel[item.status] ?? item.status}
                          </span>
                        )}
                        {item.sub && <span className={profileStyles.eventAside}>{item.sub}</span>}
                        <span className={profileStyles.eventAside}>
                          {new Date(item.ts).toLocaleString(locale, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {i < timeline.length - 1 && <div className={profileStyles.eventLink} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
