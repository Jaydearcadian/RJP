import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.RJP_API_BASE || "http://127.0.0.1:4174";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subject = searchParams.get("subject");
  const mirrorAddress = searchParams.get("mirror_address");

  if (!subject) {
    return NextResponse.json({ error: "Missing subject" }, { status: 400 });
  }

  const params = new URLSearchParams({ subject });
  if (mirrorAddress) {
    params.set("mirror_address", mirrorAddress);
  }

  try {
    const response = await fetch(`${API_BASE}/mirror-judgment?${params}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
