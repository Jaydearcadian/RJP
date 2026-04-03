import { NextRequest, NextResponse } from "next/server";
import { proxyGet } from "../_shared";

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

  return proxyGet(`/mirror-judgment?${params}`);
}
