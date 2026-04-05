import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { balance: 0, currency: "UAH" },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
