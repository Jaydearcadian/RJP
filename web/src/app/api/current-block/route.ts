import { NextRequest, NextResponse } from "next/server";
import { proxyGet } from "../_shared";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const network = searchParams.get("network") || "base-sepolia";
  return proxyGet(`/current-block?network=${encodeURIComponent(network)}`);
}
