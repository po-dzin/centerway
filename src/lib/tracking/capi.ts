/**
 * Meta Conversions API (CAPI) server-side event sender.
 * Called from job queue (type: 'meta:capi') for reliable, deduplicated reporting.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const CAPI_ENDPOINT = "https://graph.facebook.com/v19.0/{PIXEL_ID}/events";

export type CapiEventPayload = {
    event_name: "Purchase" | "Lead" | "InitiateCheckout" | "ViewContent" | "CompleteRegistration";
    event_id: string;
    event_time: number; // Unix timestamp in seconds
    value?: number;
    currency?: string;
    order_ref?: string;
    email?: string | null;
    phone?: string | null;
    fbp?: string | null;
    fbclid?: string | null;
    ip_address?: string | null;        // Клиентский IP в момент старта оплаты
    user_agent?: string | null;        // User-Agent браузера клиента
    event_source_url?: string | null;  // URL лендинга откуда пришёл пользователь
    action_source?: "website" | "system_generated";
};

function sha256(text: string): string {
    const { createHash } = require("crypto");
    return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

function buildUserData(payload: CapiEventPayload) {
    const ud: Record<string, string> = {};
    if (payload.email) ud.em = sha256(payload.email);
    if (payload.phone) {
        const digits = payload.phone.replace(/\D/g, "");
        ud.ph = sha256(digits);
    }
    if (payload.fbp) ud.fbp = payload.fbp;
    if (payload.fbclid) ud.fbc = payload.fbclid;
    // IP and UA are sent plain (Meta hashes internally)
    if (payload.ip_address) ud.client_ip_address = payload.ip_address;
    if (payload.user_agent) ud.client_user_agent = payload.user_agent;
    return ud;
}

export async function sendCapiEvent(payload: CapiEventPayload): Promise<void> {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
        console.warn("[CAPI] META_PIXEL_ID or META_ACCESS_TOKEN not set; skipping.");
        return;
    }

    const url = CAPI_ENDPOINT.replace("{PIXEL_ID}", pixelId);

    const eventData: Record<string, unknown> = {
        event_name: payload.event_name,
        event_id: payload.event_id,
        event_time: payload.event_time,
        action_source: payload.action_source ?? "website",
        user_data: buildUserData(payload),
        custom_data: payload.value
            ? {
                currency: payload.currency ?? "UAH",
                value: payload.value,
                order_id: payload.order_ref,
            }
            : {},
    };

    // event_source_url — обязательное поле для action_source=website
    if (payload.event_source_url) {
        eventData.event_source_url = payload.event_source_url;
    }

    const body: Record<string, unknown> = { data: [eventData] };

    // test_event_code только если задан (удалить в продакшне через env)
    const testCode = process.env.META_CAPI_TEST_CODE;
    if (testCode) body.test_event_code = testCode;

    const resp = await fetch(`${url}?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`CAPI error ${resp.status}: ${text}`);
    }
}
