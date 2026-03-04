/**
 * Utility for sending Meta Pixel (fbq) events from the client side.
 * Requires the base Pixel code to be embedded in the HTML <head>.
 */

// Extend window object for Typescript
declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void;
    }
}

type PixelParams = Record<string, unknown>;

/**
 * Initializes the connection to the pixel if not already done.
 * Usually handled by the hardcoded snippet in layout.tsx, but useful for SPA logic.
 */
export const initPixel = (pixelId: string) => {
    if (typeof window !== "undefined" && window.fbq) {
        window.fbq("init", pixelId);
        window.fbq("track", "PageView");
    }
};

/**
 * Track a standard Meta event (Lead, Purchase, ViewContent, InitiateCheckout)
 */
export const trackEvent = (
    eventName: "Lead" | "Purchase" | "ViewContent" | "InitiateCheckout" | "CompleteRegistration" | string,
    parameters?: PixelParams,
    eventId?: string // Deduplication ID 
) => {
    if (typeof window !== "undefined" && window.fbq) {
        if (eventId) {
            window.fbq("track", eventName, parameters, { eventID: eventId });
        } else {
            window.fbq("track", eventName, parameters);
        }
    } else {
        console.debug(`[Tracking] Would trigger ${eventName}`, parameters, eventId ? `ID: ${eventId}` : "");
    }
};

/**
 * Track a custom Meta event
 */
export const trackCustomEvent = (
    eventName: string,
    parameters?: PixelParams
) => {
    if (typeof window !== "undefined" && window.fbq) {
        window.fbq("trackCustom", eventName, parameters);
    }
};

/**
 * Read the hidden Facebook tracking cookie `_fbp` if exists.
 * Used to pass to the backend for Conversions API (CAPI).
 */
export const getFbpCookie = (): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(^|;\s*)_fbp=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : null;
};

/**
 * Extract `fbclid` from the current URL if it exists.
 */
export const getFbclid = (): string | null => {
    if (typeof window === "undefined") return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("fbclid");
};
