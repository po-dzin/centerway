import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { syncMetaAdsInsights } from "@/lib/tracking/metaAdsSync";

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const result = await syncMetaAdsInsights();
    return NextResponse.json({ success: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Meta sync cron failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
