import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SUPABASE_TOKEN_PLACEHOLDER, buildSignInCodeTemplate } from "./authEmails";

/* Supabase sends «Magic Link» to a known address and «Confirm signup» to a new
   one; the door asks for a code in both cases, so both files are this letter. */
const FILES = ["magic_link", "confirmation"].map((name) =>
  join(process.cwd(), "supabase", "templates", `${name}.html`),
);

describe("sign-in code letter", () => {
  const { subject, html } = buildSignInCodeTemplate();

  it("carries the code and no link to sign in with", () => {
    expect(subject).toBe("Код для входу в CenterWay");
    expect(html).toContain(SUPABASE_TOKEN_PLACEHOLDER);
    expect(html).not.toContain("ConfirmationURL");
  });

  it("holds no Go-template braces except the code's own", () => {
    const braces = html.match(/\{\{[^}]*\}\}/g) ?? [];
    expect(new Set(braces)).toEqual(new Set([SUPABASE_TOKEN_PLACEHOLDER]));
  });

  it("matches the templates the auth service is configured with", () => {
    if (process.env.CW_WRITE_AUTH_TEMPLATES === "1") {
      for (const file of FILES) writeFileSync(file, `${html}\n`);
    }
    for (const file of FILES) {
      expect(existsSync(file), `${file} — run npm run email:auth-templates`).toBe(true);
      expect(readFileSync(file, "utf8"), `${file} drifted — run npm run email:auth-templates`).toBe(`${html}\n`);
    }
  });
});
