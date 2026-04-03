import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.RJP_API_BASE || "http://127.0.0.1:4174";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const network = searchParams.get("network") || "base-sepolia";

  try {
    const response = await fetch(`${API_BASE}/current-block?network=${network}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
