/* The shell: sidebar, navigation, and the words every tab reuses.
 *
 * Both languages of a string live on the same line, which is the whole point
 * of the shape: a key cannot exist in one locale and not the other. */
export const layout = {
  sidebar_title: { uk: "CenterWay", en: "CenterWay" },
  nav_customers: { uk: "Клієнти", en: "Customers" },
  nav_orders: { uk: "Замовлення", en: "Orders" },
  nav_analytics: { uk: "Аналітика", en: "Analytics" },
  nav_operations: { uk: "Операції", en: "Operations" },
  nav_system: { uk: "Система", en: "System" },
} as const;
