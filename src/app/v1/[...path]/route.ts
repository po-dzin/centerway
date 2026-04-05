import { NextRequest, NextResponse } from "next/server";

function ok(payload: unknown) {
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const joined = path.join("/");

  if (joined === "me/profile") return ok({ id: null, name: null, locale: "ru" });
  if (joined === "me/balance") return ok({ balance: 0, currency: "UAH" });
  if (joined === "me/photos") return ok({ photos: [] });
  if (joined === "packages") return ok({ packages: [] });
  if (joined === "styles") return ok({ styles: [] });
  if (joined === "models") return ok({ models: [] });

  return ok({ ok: true });
}
