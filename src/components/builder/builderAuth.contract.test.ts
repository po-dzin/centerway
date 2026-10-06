import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const source = fs.readFileSync(path.join(root, "src/components/builder/BuilderShell.tsx"), "utf8");
const signIn = source.slice(
  source.indexOf("export function BuilderSignIn()"),
  source.indexOf("/** A panel that states"),
);

describe("Builder local sign-in", () => {
  it("does not offer Google OAuth when local Supabase disables that provider", () => {
    expect(signIn).toContain('process.env.NEXT_PUBLIC_AUTH_GOOGLE === "off"');
    expect(signIn).toMatch(/if \(localAuth\)[\s\S]*?signInLocally[\s\S]*?return \(/);
  });

  it("uses the local email/password account and gives a service-down recovery message", () => {
    expect(signIn).toContain("supabaseClient.auth.signInWithPassword({ email, password })");
    expect(signIn).toContain("local-dev");
    expect(signIn).toContain("Перевірте, чи запущений Supabase");
  });
});
