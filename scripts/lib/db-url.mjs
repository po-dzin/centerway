/**
 * The production database, reachable.
 *
 * `SUPABASE_DB_URL` in .env.local names the direct host, `db.<ref>.supabase.co`,
 * which resolves only to IPv6 and is unreachable from a v4-only machine. The
 * session pooler answers on IPv4 with the same password and the user
 * `postgres.<ref>`. Every script that talks to the database goes through this
 * one rewrite (see memory: supabase-db-cli-route).
 */
import { readFileSync } from "node:fs";

const POOLER_HOST = "aws-1-eu-west-2.pooler.supabase.com";

export function loadDotEnv(files = [".env.local", ".env"]) {
  for (const file of files) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
      }
    } catch {
      /* optional */
    }
  }
}

/** The pooler URL derived from SUPABASE_DB_URL, or an explanation of why not. */
export function poolerUrl() {
  loadDotEnv();
  const direct = process.env.SUPABASE_DB_URL;
  if (!direct) throw new Error("SUPABASE_DB_URL is not set (put it in .env.local)");
  const m = direct.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.*)$/);
  if (!m) throw new Error("SUPABASE_DB_URL is not the direct db.<ref>.supabase.co form this rewrite expects");
  const [, , password, ref, database] = m;
  return `postgresql://postgres.${ref}:${password}@${POOLER_HOST}:5432/${database}`;
}

/** The same URL with the password masked, for logs. */
export function describe(url) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@");
}
