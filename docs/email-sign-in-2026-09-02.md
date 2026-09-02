# Email sign-in — the door for buyers who are not on Google

Date: 2026-09-02
Status: code shipped, **two dashboard steps still required before it works in production** (§3).
Contract: `src/lib/auth/emailSignIn.ts`, `src/components/auth/EmailSignIn.tsx`,
`src/components/auth/SignInOptions.tsx`, `src/lib/supabaseClient.ts`.

---

## 1. What was broken

Entitlement is linked to an account by **verified email**. `findCustomerIds`
(`src/lib/lms/server.ts`) matches a paid `customers` row to a person only when
the auth provider confirmed the address, and `/api/platform/users/sync` passes
`emailVerified: Boolean(user.email_confirmed_at)`.

Until today the only provider was Google (six call sites, all
`signInWithOAuth({ provider: "google" })`). So a buyer who paid with an ukr.net,
i.ua, meta.ua or iCloud address did not "sign in to the wrong account" — **they
could not sign in as that identity at all**, and no self-service route existed
to reach the course they had paid for. The receipt tells them which address owns
the purchase and, before this, gave them no way to use it.

Every such sale was a support ticket or a refund. On cold paid traffic, where we
do not get to pick the buyer's mail host, that is a structural leak rather than
an edge case.

## 2. What changed, and what deliberately did not

**Nothing downstream changed.** Supabase sets `email_confirmed_at` after a
one-time code exactly as it does after OAuth, so the existing linking, shelf and
entitlement logic already treat an email-verified account as the owner of that
address's purchases. This work is a door, not a new lock.

- `src/lib/auth/emailSignIn.ts` — the logic, with no React and no Supabase
  client in it: address normalisation, code normalisation, and the mapping from
  a Supabase error to something a person can act on. Unit-tested.
- `src/components/auth/EmailSignIn.tsx` — the two steps, in one component,
  because sending the code and typing it back are one act to the person doing
  it and the address has to stay on screen while they are asked for the code.
- `src/components/auth/SignInOptions.tsx` — email first, then `або`, then
  Google. Email leads because it is the one that always works; Google stays one
  tap below because today every existing account was made that way.
- Wired into both gates that a buyer can hit: `CabinetGate` (`/learn`,
  `/profile` — where the receipt sends them) and `RouteAuthGate`.

**A typed code, not a magic link**, and the difference decides whether this
works for the traffic it is built for. Paid social arrives inside the Instagram
and Facebook in-app browsers. A magic link opens in the *system* browser, so the
session lands somewhere other than where the person is standing; they return to
the in-app tab still signed out, having done everything right. A code is read in
the mail app and typed into the tab that is already open — which also works when
the mail is on a different device.

**Not done here**, still open from the audit: a "I paid with a different
address" claim flow keyed on the order reference. That covers the narrower case
of a buyer who mistyped their address at WayForPay. Email sign-in covers
everyone who typed it correctly, which is the large majority.

## 3. Required before this works in production

Both are Supabase dashboard settings. The code is live without them and will
fail in a way that looks like "the email never arrived".

### 3.1 The email template must carry the code

Auth → Emails → **Magic Link** template. It must contain `{{ .Token }}`.

Supabase's default template contains only `{{ .ConfirmationURL }}`, i.e. a link.
If it is left that way, `signInWithOtp` sends a link, the person never sees six
digits, and the screen asking for them cannot be completed. Suggested body:

```html
<h2>Вхід у CenterWay</h2>
<p>Ваш код для входу:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:0.15em">{{ .Token }}</p>
<p>Код діє 15 хвилин. Якщо ви не намагалися увійти — просто проігноруйте цей лист.</p>
```

While there: Auth → Providers → Email → set **OTP expiry** to 900 seconds. The
default is an hour, which is a long time for a credential sitting in an inbox.

### 3.2 Custom SMTP, or almost nobody gets a code

Auth → Settings → **SMTP Settings**.

Supabase's built-in sender is rate limited to a couple of messages per hour and
is documented as not for production use. Left as is, the second buyer of the
morning gets nothing, and we will read it as "email is flaky" rather than as a
quota.

Resend is already integrated and its domain is already verified for the receipt
(`docs/purchase-receipt-email-2026-08-29.md`), so point Supabase at the same
sender:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the existing `RESEND_API_KEY` |
| Sender email | an address on `send.centerway.net.ua` |
| Sender name | CenterWay |

Then raise Auth → Rate Limits → "Emails sent per hour" above the built-in
default, since that ceiling stays in force even with custom SMTP.

### 3.3 Check the redirect allow-list

Auth → URL Configuration. The code flow does not depend on a redirect, but
`emailRedirectTo` is passed so that a template that also carries a link lands
somewhere sane. `https://my.centerway.net.ua/**` and
`https://www.centerway.net.ua/**` should both be allowed.

## 4. How to verify it end to end

Needs a real mailbox that is **not** the Google account already used for
CenterWay — the point is to prove the non-Google path.

1. Open `my.centerway.net.ua/profile` signed out. The email field leads, Google
   sits below `або`.
2. Enter the address, "Надіслати код". A code arrives within a minute.
3. Enter it. The gate resolves into the cabinet without a page reload —
   `onAuthStateChange` carries `SIGNED_IN` to the shell.
4. In the database, that address now has an `auth.users` row with
   `email_confirmed_at` set.
5. **The real test**: have a paid order whose `customers.email` equals that
   address, and confirm the course appears on the shelf immediately after
   sign-in. That is `linkPurchasesToAccount` doing the thing this whole change
   exists for.
6. Wrong code, then expired code: both must produce their own message, not the
   generic one.

## 5. Known edges

- **Resending** is held for 60 seconds client-side, on top of whatever Supabase
  enforces. A person who asks twice quickly sees a countdown, not an error.
- **A buyer with no account yet** is created on first code (`shouldCreateUser:
  true`). This is deliberate: the purchase was made against an email, not an
  account, so refusing to create one would rebuild the wall.
- **The same person with both Google and email** on one address is one
  `auth.users` row — Supabase links identities by verified email. They can use
  either door.
- **A typo'd address at WayForPay** is still unreachable by self-service. That
  is the claim flow named in §2, not yet built.
