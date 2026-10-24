/**
 * Can mail be delivered to this address's domain at all (2026-10-22)?
 *
 * The grant dialog creates accounts for addresses nobody has signed in with,
 * and a typo in the domain (`gmial.com`, `gmail.co`) made a platform account
 * that no letter would ever reach — it surfaced only later, as a permanent
 * bounce in the mailing list. A domain with no mail exchanger (no MX, or the
 * null MX `0 .`) is refused before the account exists.
 *
 * It cannot catch a typo before the `@` (`cenrertheway@gmail.com`): only the
 * mailbox's own server knows, and only a letter asks it. Those accounts are
 * removed with `deleteEmptyAccount` instead.
 *
 * A DNS failure that is not an answer (timeout, resolver down) lets the
 * address through: an outage must not stop a sale.
 */

import { resolveMx } from "node:dns/promises";

const cache = new Map<string, boolean>();

export async function domainAcceptsMail(email: string): Promise<boolean> {
  // Tests use example.com, whose MX is the null MX by design; they do not reach the network.
  if (process.env.NODE_ENV === "test") return true;
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  const known = cache.get(domain);
  if (known !== undefined) return known;
  try {
    const records = await resolveMx(domain);
    const accepts = records.some((record) => record.exchange && record.exchange !== ".");
    cache.set(domain, accepts);
    return accepts;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      cache.set(domain, false);
      return false;
    }
    return true;
  }
}
