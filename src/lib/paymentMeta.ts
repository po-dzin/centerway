export type PaymentMeta = {
    rrn: string | null;
    amount: string | null;
    currency: string | null;
    email: string | null;
    phone: string | null;
    card: string | null; // masked / pan (если прилетит)
  };
  
  function asObj(x: unknown): Record<string, any> | null {
    return x && typeof x === "object" ? (x as any) : null;
  }
  
  function pickStr(obj: Record<string, any> | null, keys: string[]): string | null {
    if (!obj) return null;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return null;
  }
  
  export function extractPaymentMeta(rawPayload: unknown): PaymentMeta {
    const obj = asObj(rawPayload);
  
    const rrn = pickStr(obj, ["rrn", "RRN"]);
    const amount = pickStr(obj, ["amount", "paymentAmount", "orderAmount"]);
    const currency = pickStr(obj, ["currency", "orderCurrency", "paymentCurrency"]);
    const email = pickStr(obj, ["email", "payerEmail"]);
    const phone = pickStr(obj, ["phone", "payerPhone"]);
    const card = pickStr(obj, ["cardPan", "card", "maskedCard", "pan"]);
  
    return {
      rrn,
      amount,
      currency,
      email,
      phone,
      card,
    };
  }  