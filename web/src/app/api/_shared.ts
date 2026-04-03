import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.RJP_API_BASE || "http://127.0.0.1:4174";

async function parseProxyResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function proxyGet(requestPath: string): Promise<NextResponse> {
  try {
    const response = await fetch(`${API_BASE}${requestPath}`, {
      cache: "no-store",
    });
    const data = await parseProxyResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function proxyPost(
  request: NextRequest,
  requestPath: string
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE}${requestPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await parseProxyResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
