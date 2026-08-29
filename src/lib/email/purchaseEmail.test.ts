import { describe, expect, it } from "vitest";

import { buildPurchaseEmail } from "./purchaseEmail";

const base = {
  email: "buyer@example.com",
  productTitle: "Reset Day",
  amount: 795,
  currency: "UAH",
  orderRef: "reset-day_20260829_abc123",
};

describe("buildPurchaseEmail", () => {
  it("carries the order, the price and a link to the course", () => {
    const mail = buildPurchaseEmail({ ...base, fulfilment: { kind: "course", courseSlug: "reset-day" } });

    expect(mail.subject).toBe("Оплату отримано — Reset Day");
    expect(mail.text).toContain("795 UAH");
    expect(mail.text).toContain("reset-day_20260829_abc123");
    /* Absolute, because a mail client has no origin to resolve against — and on
       the PERSONAL host, where the course lives and where `/learn` is not part
       of the path. Same URL `/pay/thanks` hands out, which is the point: the
       receipt and the confirmation page must not disagree about where the
       course is. */
    expect(mail.text).toContain("https://my.centerway.net.ua/reset-day");
    expect(mail.html).toContain("https://my.centerway.net.ua/reset-day");
  });

  /**
   * The load-bearing paragraph. Entitlement is matched on the buyer's verified
   * email (`findCustomerIds`), so a buyer who signs in with a different address
   * silently owns nothing. This message is the only place that says so.
   */
  it("tells the buyer which address to sign in with", () => {
    const mail = buildPurchaseEmail({ ...base, fulfilment: { kind: "course", courseSlug: "reset-day" } });
    expect(mail.text).toContain("buyer@example.com");
    expect(mail.html).toContain("buyer@example.com");
  });

  /**
   * ...but only when signing in is the point. A Telegram product is collected
   * in the bot, where the platform account does not come into it — telling
   * that buyer about an address they never need is noise that makes the real
   * instruction easier to ignore in the messages that do need it.
   */
  it("omits the sign-in note for a product collected in the bot", () => {
    const mail = buildPurchaseEmail({
      ...base,
      productTitle: "Short Reboot",
      fulfilment: { kind: "bot", url: "https://telegram.me/ShortRebotBot?start=x" },
    });
    expect(mail.text).not.toContain("buyer@example.com");
    expect(mail.text).toContain("https://telegram.me/ShortRebotBot?start=x");
  });

  it("falls back to the cabinet when the product declares no destination", () => {
    const mail = buildPurchaseEmail({ ...base, fulfilment: { kind: "cabinet" } });
    expect(mail.text).toContain("https://my.centerway.net.ua/profile");
  });

  it("drops the price line rather than printing a broken one", () => {
    const mail = buildPurchaseEmail({
      ...base,
      amount: null,
      fulfilment: { kind: "cabinet" },
    });
    expect(mail.text).not.toContain("Сума:");
    expect(mail.html).not.toContain("Сума:");
  });

  /** A product name is data, and it reaches this template on its way to a browser. */
  it("escapes markup in the product title", () => {
    const mail = buildPurchaseEmail({
      ...base,
      productTitle: '<script>alert("x")</script>',
      fulfilment: { kind: "cabinet" },
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("keeps every message in the «ви» register the rest of the platform uses", () => {
    const mail = buildPurchaseEmail({ ...base, fulfilment: { kind: "course", courseSlug: "reset-day" } });
    expect(mail.text).not.toMatch(/\bти\b|\bтвій\b|\bтвоя\b|\bзаходь\b/i);
  });
});
