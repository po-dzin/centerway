import { NextRequest, NextResponse } from "next/server";

import { log } from "@/lib/logger";
import { escapeHtml } from "@/lib/strings";
import { setSubscriptionStatus } from "@/lib/broadcasts/server";
import { verifyUnsubscribeToken } from "@/lib/broadcasts/unsubscribeToken";

/**
 * The way out of the list, from the link at the foot of every broadcast and
 * from the mailbox's own «unsubscribe» button.
 *
 * GET shows a page with one button; it does NOT unsubscribe. Mail scanners and
 * link previews fetch every URL in a message, and an unsubscribe that fires on
 * GET quietly empties the list of exactly the people whose corporate filters
 * are thorough.
 *
 * POST unsubscribes. It is both the page's button and RFC 8058 one-click: the
 * mailbox POSTs `List-Unsubscribe=One-Click` to the URL in the header, no
 * session, no page. The signed token in the query is the whole authority — see
 * unsubscribeToken.ts.
 */

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · CenterWay</title></head>
<body style="margin:0;background:#f6f3ef;color:#2b2723;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">
<main style="max-width:480px;margin:0 auto;padding:64px 20px">
<p style="margin:0 0 24px;font-weight:700;letter-spacing:.02em">CenterWay</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${escapeHtml(title)}</h1>
${body}
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

const INVALID = () =>
  page(
    "Посилання не спрацювало",
    `<p style="margin:0">Можливо, його скопійовано не повністю. Відкрийте посилання з листа ще раз або напишіть нам — відпишемо вручну.</p>`,
    400,
  );

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const claim = verifyUnsubscribeToken(token);
  if (!claim) return INVALID();
  return page(
    "Відписатися від розсилки?",
    `<p style="margin:0 0 24px">Листи з новинами й анонсами більше не надходитимуть на <strong>${escapeHtml(claim.address)}</strong>. Листи про ваші покупки й доступ до курсів залишаться.</p>
<form method="post" action="/api/unsubscribe?t=${encodeURIComponent(token ?? "")}">
<button type="submit" style="font:inherit;font-weight:700;background:#2b2723;color:#fff;border:0;border-radius:8px;padding:12px 22px;cursor:pointer">Відписатися</button>
</form>`,
  );
}

export async function POST(req: NextRequest) {
  const claim = verifyUnsubscribeToken(req.nextUrl.searchParams.get("t"));
  const oneClick = (await req.text().catch(() => "")).includes("List-Unsubscribe=One-Click");
  if (!claim) return oneClick ? new NextResponse(null, { status: 400 }) : INVALID();

  try {
    await setSubscriptionStatus(claim.address, "unsubscribed", {
      source: "unsubscribe_link",
      reason: oneClick ? "one_click" : "unsubscribe_link",
      broadcastId: claim.broadcastId,
    });
  } catch (error) {
    log.error("broadcasts.unsubscribe_failed", { message: error instanceof Error ? error.message : String(error) });
    return oneClick
      ? new NextResponse(null, { status: 500 })
      : page(
          "Щось пішло не так",
          `<p style="margin:0">Спробуйте ще раз за хвилину або напишіть нам — відпишемо вручну.</p>`,
          500,
        );
  }

  if (oneClick) return new NextResponse(null, { status: 200 });
  return page(
    "Готово",
    `<p style="margin:0">Ви відписалися від розсилки. Листи про ваші покупки й доступ до курсів залишаться.</p>`,
  );
}
