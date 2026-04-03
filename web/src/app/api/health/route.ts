import { NextResponse } from "next/server";

const API_BASE = process.env.RJP_API_BASE || "http://127.0.0.1:4174";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
