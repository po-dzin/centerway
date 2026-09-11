/* The door and what greets a signed-in operator behind it.
 *
 * Both languages of a string live on the same line, which is the whole point
 * of the shape: a key cannot exist in one locale and not the other. */
export const auth = {
  login_title: { uk: "Control Panel", en: "Control Panel" },
  login_subtitle: { uk: "Модуль обмеженого доступу", en: "Restricted Access Module" },
  login_card_title: { uk: "Вхід у систему", en: "System Login" },
  login_card_subtitle: { uk: "Введіть облікові дані для входу в L0.", en: "Provide credentials to enter L0." },
  login_btn: { uk: "Увійти", en: "Sign In" },
  admin_access_denied_title: { uk: "Доступ обмежено", en: "Access restricted" },
  admin_access_denied_subtitle: {
    uk: "Ваш акаунт авторизовано, але він не має ролі admin/support. Зверніться до адміністратора системи.",
    en: "Your account is authenticated but has no admin/support role. Please contact a system administrator.",
  },
  menu_signout: { uk: "Вийти", en: "Sign Out" },
  loading: { uk: "Завантаження...", en: "Loading..." },
  common_prev: { uk: "Попередня", en: "Previous" },
  common_next: { uk: "Наступна", en: "Next" },
  common_page: { uk: "Сторінка", en: "Page" },
  common_of: { uk: "з", en: "of" },
  common_error: { uk: "Помилка", en: "Error" },
  common_unknown: { uk: "невідомо", en: "unknown" },
  common_currency_uah: { uk: "UAH", en: "UAH" },
  common_expand: { uk: "Розгорнути", en: "Expand" },
  common_collapse: { uk: "Згорнути", en: "Collapse" },
  common_switch_language: { uk: "Змінити мову", en: "Switch language" },
  common_close: { uk: "Закрити", en: "Close" },
} as const;
