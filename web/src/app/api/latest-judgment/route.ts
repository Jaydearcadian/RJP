import { NextRequest, NextResponse } from "next/server";
import { proxyGet } from "../_shared";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subject = searchParams.get("subject");

  if (!subject) {
    return NextResponse.json({ error: "Missing subject" }, { status: 400 });
  }

  return proxyGet(`/latest-judgment?subject=${encodeURIComponent(subject)}`);
}
