import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => ({}));

  const { error } = await supabase.from("events").insert({
    type: "test_event",
    order_ref: body.order_ref ?? null,
    payload: body,
  });

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
