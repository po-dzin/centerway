/**
 * Shapes the products tab and its API agree on.
 *
 * Apart from `productOffers.ts` for the same reason `catalogTypes.ts` is apart
 * from `catalog.ts`: that module imports the service-role client, and the
 * screen is a client component that must be able to name these types without
 * dragging the server module into the browser bundle.
 */

export type ProductOfferKind = "checkout" | "lead";

export type ProductOffer = {
    code: string;
    amount: number | null;
    listAmount: number | null;
    currency: string;
    kind: ProductOfferKind;
    pixelContentName: string | null;
    active: boolean;
    updatedAt: string | null;
};

export type ProductOfferRow = {
    code: string;
    title: string;
    expectedKind: ProductOfferKind;
    offer: ProductOffer | null;
};
