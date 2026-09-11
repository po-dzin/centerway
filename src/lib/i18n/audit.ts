/* The audit log: security events and manual admin actions.
 *
 * Both languages of a string live on the same line, which is the whole point
 * of the shape: a key cannot exist in one locale and not the other. */
export const audit = {
  audit_title: { uk: "Аудит", en: "Audit Log" },
  audit_subtitle: {
    uk: "Події безпеки та ручні дії адміністраторів.",
    en: "Security events and manual actions performed by admins.",
  },
  audit_col_time: { uk: "Час (UTC)", en: "Time (UTC)" },
  audit_col_actor: { uk: "Користувач", en: "Actor" },
  audit_col_action: { uk: "Дія", en: "Action" },
  audit_col_entity: { uk: "Об’єкт", en: "Entity" },
  audit_col_details: { uk: "Деталі", en: "Details" },
  audit_loading: { uk: "Завантаження логів...", en: "Loading logs..." },
  audit_empty: { uk: "Записів не знайдено.", en: "No audit logs found." },
} as const;
