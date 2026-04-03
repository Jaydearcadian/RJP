import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.RJP_API_BASE || "http://127.0.0.1:4174";

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

  try {
    const response = await fetch(`${API_BASE}/handshake-preview?${params}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
