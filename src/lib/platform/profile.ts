import { parseCourseOfferCode } from "@/lms-core/offerCode";

export type PlatformProfileOfferKind = "program" | "mini-course" | "product" | "lead" | "unknown";

export function getOfferMeta(productCode: string | null | undefined): {
  code: string;
  title: string;
  kind: PlatformProfileOfferKind;
} {
  const code = (productCode ?? "").trim().toLowerCase();

  /* `course:<slug>` is the code every offer is filed under since the offer
     codes became one channel; the cases below are keyed by the older names. */
  switch (parseCourseOfferCode(code) ?? code) {
    case "short":
    case "reboot":
      return { code: "short", title: "Short-Перезавантаження", kind: "mini-course" };
    case "irem":
    case "irem-gymnastics":
      return { code: "irem", title: "IREM Гімнастика", kind: "program" };
    case "natural-body":
    case "ideal-body":
      return { code: "natural-body", title: "Природнє тіло з Аюрведою", kind: "program" };
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
      return { code: "reset-day", title: "Розвантажувальний день", kind: "mini-course" };
    default:
      return {
        code: code || "unknown",
        title: productCode?.trim() || "Невідомий продукт",
        kind: "unknown",
      };
  }
}
