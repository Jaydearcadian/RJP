import { NextRequest, NextResponse } from "next/server";
import { proxyGet } from "../_shared";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subject = searchParams.get("subject");
  const actionType = searchParams.get("action_type") || "trade";
  const demoAddress = searchParams.get("demo_address");

  if (!subject) {
    return NextResponse.json({ error: "Missing subject" }, { status: 400 });
  }

  const params = new URLSearchParams({ subject, action_type: actionType });
  if (demoAddress) {
    params.set("demo_address", demoAddress);
  }

  return proxyGet(`/handshake-preview?${params}`);
}
