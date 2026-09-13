/* System health and the operational switches.
 *
 * Both languages of a string live on the same line, which is the whole point
 * of the shape: a key cannot exist in one locale and not the other. */
export const system = {
  system_title: { uk: "Система", en: "System" },
  system_subtitle: {
    uk: "Низькочастотні системні та комплаєнс-інструменти.",
    en: "Low-frequency system and compliance tools.",
  },
  system_card_audit_label: { uk: "Контроль", en: "Control" },
  system_card_audit_title: { uk: "Аудит", en: "Audit Log" },
  system_card_audit_desc: { uk: "Логи безпеки та дій адміністраторів.", en: "Security and administrator action logs." },
  system_card_integrations_label: { uk: "Інтеграції", en: "Integrations" },
  system_card_integrations_title: { uk: "Стан та інтеграції", en: "Health & Integrations" },
  system_card_integrations_desc: {
    uk: "Розділ буде розширено: health, API-конектори, доступи.",
    en: "This section will include health checks, connectors, and access controls.",
  },
} as const;
