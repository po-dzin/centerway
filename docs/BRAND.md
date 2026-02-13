# CenterWay Brand Definition

## 1. Brand Core

- **Brand name:** CenterWay
- **Category:** Wellness education and guided practice programs
- **Primary promise:** Practical methods that improve daily physical and psycho-emotional state through consistent, structured routines.
- **Positioning:** Expert-led, structured, actionable wellness programs with clear everyday application.

## 2. Brand Architecture

- **Master brand:** CenterWay
- **Product funnel A:** `reboot.centerway.net.ua` — **Short Reboot**
  - Entry product for quick daily reset.
  - Fast, low-friction onboarding.
- **Product funnel B:** `irem.centerway.net.ua` — **IREM Gymnastics**
  - Deeper recovery and system practice.
  - Includes pre-checkout qualification form.

## 3. Separation Rule (Critical)

- Product landings are operationally independent.
- No cross-links between `Short Reboot` and `IREM` landing flows.
- No navigation from product landing to a generic “main site” hub.
- Each landing must keep user attention inside its own funnel: entry -> checkout -> payment result -> bot.

## 4. Target Audience (High Level)

- Adults who need daily recovery, energy, stress reduction, and body-state stabilization.
- Users who prefer guided, step-by-step routines over abstract theory.

## 5. Tone of Voice

- Clear, grounded, practical.
- Confident expert tone without hype.
- Specific outcomes and instructions over vague promises.
- Respectful, concise, no manipulative pressure language.

## 6. Messaging Guardrails

- Emphasize routine, consistency, and realistic progress.
- Do not position content as medical diagnosis/treatment.
- Use explicit CTAs tied to the current product journey only.
- Keep legal/offer language consistent with payment and access flow.

## 7. Conversion Flow Contract

For both products:
1. Landing entry
2. Content view
3. Primary CTA click
4. Checkout start
5. Payment page open (WayForPay)
6. Payment status verification
7. `thanks` or `pay-failed`
8. Bot transition (auto + manual buttons)

