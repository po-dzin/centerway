import { NextResponse } from "next/server";
import { secretsEqual } from "@/lib/auth/secretsEqual";

export function requireCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ success: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!secretsEqual(token, cronSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return null;
}
