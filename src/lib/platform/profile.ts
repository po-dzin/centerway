export type PlatformProfileOfferKind = "program" | "mini-course" | "product" | "lead" | "unknown";

export function getOfferMeta(productCode: string | null | undefined): {
  code: string;
  title: string;
  kind: PlatformProfileOfferKind;
} {
  const code = (productCode ?? "").trim().toLowerCase();

  switch (code) {
    case "short":
    case "reboot":
      return { code: "short", title: "Short Reboot", kind: "mini-course" };
    case "irem":
      return { code: "irem", title: "IREM Гімнастика", kind: "program" };
    case "ideal-body":
      return { code: "ideal-body", title: "Ідеальне тіло з Аюрведою", kind: "program" };
    case "consult":
      return { code: "consult", title: "Консультація", kind: "lead" };
    case "herbs":
      return { code: "herbs", title: "Травʼяний збір", kind: "product" };
    case "platform":
      return { code: "platform", title: "Запит із платформи", kind: "lead" };
    case "detox":
    case "way21":
      return { code: "way21", title: "Шлях 21", kind: "program" };
    case "mini-detox":
    case "reset-day":
      return { code: "reset-day", title: "Reset Day", kind: "mini-course" };
    default:
      return {
        code: code || "unknown",
        title: productCode?.trim() || "Невідомий маршрут",
        kind: "unknown",
      };
  }
}

export function formatOnboardingState(state: string | null | undefined): string {
  switch ((state ?? "").trim().toLowerCase()) {
    case "new":
      return "Новий профіль";
    case "profile_completed":
      return "Профіль заповнено";
    case "test_completed":
      return "Доша-тест завершено";
    case "active":
      return "Активний користувач";
    default:
      return "Стан онбордингу не визначено";
  }
}

export function formatOrderStatus(status: string | null | undefined): string {
  switch ((status ?? "").trim().toLowerCase()) {
    case "paid":
      return "Оплачено";
    case "created":
      return "Створено";
    case "pending":
      return "Очікує оплату";
    case "refunded":
      return "Повернення";
    default:
      return status?.trim() || "Невідомий статус";
  }
}

export function formatTokenStatus(used: boolean, expiresAt: string | null | undefined): string {
  if (used) return "Доступ використано";
  if (!expiresAt) return "Доступ створено";
  if (Date.now() > new Date(expiresAt).getTime()) return "Термін доступу минув";
  return "Доступ активний";
}
