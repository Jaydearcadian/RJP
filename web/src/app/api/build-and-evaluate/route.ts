import { NextRequest } from "next/server";
import { proxyPost } from "../_shared";

export async function POST(request: NextRequest) {
  return proxyPost(request, "/build-and-evaluate");
}
