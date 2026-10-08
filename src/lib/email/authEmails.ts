/**
 * The sign-in code letter, in the platform's own frame.
 *
 * WHY THIS FILE BUILDS A TEMPLATE AND SENDS NOTHING. The code is minted and
 * mailed by Supabase Auth, not by us, so the letter is a Go template stored in
 * the project's auth settings. This builder renders that template from the same
 * frame every other letter uses, with Supabase's placeholder where the code
 * goes; `npm run email:auth-templates` writes it to `supabase/templates/` (and
 * `authEmails.test.ts` fails when those files drift from the frame), which
 * the local stack reads (config.toml) and production takes by a PATCH of the
 * project's auth config.
 *
 * Supabase sends one of two templates for the same request: «Magic Link» to an
 * address that already has an account, «Confirm signup» to one that does not
 * (the door creates the account — a buyer has none yet). The person sees one
 * thing either way: a code. So both are this letter.
 *
 * The door reads a 6-digit code and never a link (EmailSignIn.tsx), so the
 * letter carries no link to click: a link would sign in a different browser
 * than the tab that is waiting for the code.
 */

import { renderEmailLayout } from "./layout";

/** Supabase's Go-template placeholder for the one-time code. */
export const SUPABASE_TOKEN_PLACEHOLDER = "{{ .Token }}";

export type AuthTemplate = { subject: string; html: string };

export function buildSignInCodeTemplate(code: string = SUPABASE_TOKEN_PLACEHOLDER): AuthTemplate {
  const html = renderEmailLayout({
    preheader: `Ваш код для входу в CenterWay: ${code}`,
    eyebrow: "Вхід",
    title: "Ваш код для входу",
    blocks: [
      { kind: "paragraph", html: "Введіть цей код на сторінці, де ви почали вхід:" },
      { kind: "code", code },
      {
        kind: "paragraph",
        html: "Код одноразовий і діє недовго. Якщо ви не намагалися увійти — просто проігноруйте цей лист: без коду ніхто не відкриє ваш акаунт.",
      },
    ],
    signature: "Команда CenterWay",
  });
  return { subject: "Код для входу в CenterWay", html };
}
