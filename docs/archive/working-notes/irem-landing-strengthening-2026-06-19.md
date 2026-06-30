# IREM Landing Strengthening — 2026-06-19

Local operational note for the June 2026 strengthening wave on the public `/irem` funnel.

## Goal

Strengthen the IREM landing as a direct-sales funnel without changing checkout/runtime contracts.

## Block hierarchy

Current intended public order:

1. Hero
2. Problem / fit
3. Structure of practice
4. `addon-method-analysis`
5. `addon-results`
6. `addon-foundations`
7. Program
8. `addon-protocol`
9. Included-in-program
10. Proof
11. Expert / curator
12. `addon-formats`
13. Final offer
14. FAQ
15. `addon-short-entry`

## CTA policy

- Primary CTA across hero, sticky, formats-main, and final offer is `Приєднатися до IREM`.
- Premium route is separate and uses Telegram only.
- Short is not shown on the same level as IREM and premium. It lives in a dedicated lower support block.
- Short remains an explicit route exception from `/irem` to the Short funnel and must not be visually equal to the main IREM offer.

## Claim policy

Bounded copy rules for this wave:

- prefer `система побудована так, щоб...`
- prefer `практика спрямована на...`
- prefer `за умови регулярних занять можна очікувати...`
- prefer `учасники часто відзначають...`
- keep `не є медичною діагностикою чи лікуванням` visible in the page

Do not ship direct absolute language from source analysis text such as:

- `ідеально`
- `безпрецедентно`
- `гарантується`
- `еліксир`
- medical-sounding causality as a fact claim

## Analytics contract

- IREM checkout CTAs continue to feed `InitiateCheckout`.
- Premium Telegram CTA emits `IremPremiumContact`.
- Short fallback CTA emits `IremShortRoute`.

## Canon sync

This wave changes CTA hierarchy and preserves a controlled `irem -> short` route exception.

Minimum follow-through:

- local note: this file
- shared canon: update `Бренд-контракт` or `Лендинги` to describe the support-level exception
