import { proxyGet } from "../_shared";

export async function GET() {
  return proxyGet("/health");
}
