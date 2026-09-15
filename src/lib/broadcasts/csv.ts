/**
 * A contacts export — SendPulse's, or any spreadsheet — read into rows the
 * import can trust.
 *
 * Pure. Tolerant of what real exports look like: a `;` or tab instead of a
 * comma (Excel in a Ukrainian locale writes `;`), a BOM, quoted fields with
 * commas and doubled quotes inside, headers in three languages, and no header
 * at all. What it will not do is guess an address: a row without something
 * shaped like an email is counted as invalid, never imported.
 *
 * A status column is honoured because it is the point of importing from a
 * service that already held consent: someone who unsubscribed in SendPulse must
 * arrive here unsubscribed, not be mailed again on the first campaign.
 */

export type ImportStatus = "subscribed" | "unsubscribed" | "bounced";
export type ImportRow = { email: string; name: string | null; status: ImportStatus };
export type ParsedContacts = { rows: ImportRow[]; invalid: number; duplicates: number };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  const best = counts[0];
  return best && best[1] > 1 ? best[0] : ",";
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const EMAIL_HEADERS = /^(e-?mail|email address|електронна пошта|пошта|почта|электронная почта|адреса|адрес)$/i;
const NAME_HEADERS = /^(name|full name|first name|ім'?я|імʼя|им[яе]|фио|піб)$/i;
const STATUS_HEADERS = /^(status|статус|subscription status|стан)$/i;

export function mapStatus(raw: string | undefined): ImportStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if (/unsub|відпис|отпис|opt.?out|blocked|заблок/.test(value)) return "unsubscribed";
  if (/bounce|недостав|invalid|hard/.test(value)) return "bounced";
  return "subscribed";
}

export function parseContacts(text: string): ParsedContacts {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], invalid: 0, duplicates: 0 };

  const firstRow = table[0] ?? [];
  const header = firstRow.map((cell) => cell.trim());
  let emailCol = header.findIndex((cell) => EMAIL_HEADERS.test(cell));
  const nameCol = header.findIndex((cell) => NAME_HEADERS.test(cell));
  const statusCol = header.findIndex((cell) => STATUS_HEADERS.test(cell));
  let body = table.slice(1);

  if (emailCol === -1) {
    // No recognisable header: the first row may already be data. Take the
    // first column holding an address in it.
    const probe = firstRow.findIndex((cell) => EMAIL_RE.test(cell.trim()));
    if (probe !== -1) {
      emailCol = probe;
      body = table;
    } else {
      emailCol = header.findIndex((cell) => /mail|пошт|почт/i.test(cell));
    }
  }
  if (emailCol === -1) return { rows: [], invalid: body.length, duplicates: 0 };

  const seen = new Map<string, ImportRow>();
  let invalid = 0;
  let duplicates = 0;
  for (const cells of body) {
    const email = (cells[emailCol] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) {
      invalid++;
      continue;
    }
    const name = nameCol >= 0 ? (cells[nameCol] ?? "").trim() || null : null;
    const status = statusCol >= 0 ? mapStatus(cells[statusCol]) : "subscribed";
    const existing = seen.get(email);
    if (existing) {
      duplicates++;
      // The stricter status wins: one «unsubscribed» line anywhere is a no.
      if (existing.status === "subscribed" && status !== "subscribed") existing.status = status;
      if (!existing.name && name) existing.name = name;
      continue;
    }
    seen.set(email, { email, name, status });
  }
  return { rows: [...seen.values()], invalid, duplicates };
}
