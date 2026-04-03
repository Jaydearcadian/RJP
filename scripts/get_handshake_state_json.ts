#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { toPlainJsonValue } from "./lib/format_genlayer_result";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const subjectId = process.env.SUBJECT_ID || process.argv[3];
const actionType = process.env.ACTION_TYPE || process.argv[4] || "trade";
const currentSourceBlockRaw = process.env.CURRENT_SOURCE_BLOCK || process.argv[5] || "";

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[3]");
}

const currentSourceBlock =
  currentSourceBlockRaw.trim().length > 0 ? Number(currentSourceBlockRaw) : null;
if (currentSourceBlockRaw.trim().length > 0 && !Number.isFinite(currentSourceBlock)) {
  throw new Error("CURRENT_SOURCE_BLOCK must be a finite number when provided");
}

const account = createAccount(normalizePrivateKey(privateKey));
const client = createClient({
  chain: {
    ...studionet,
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  },
  account,
});

async function main() {
  const result = await client.readContract({
    address: rjpAddress as `0x${string}`,
    functionName:
      currentSourceBlock === null
        ? "get_handshake_state"
        : "get_handshake_state_with_source_block",
    args:
      currentSourceBlock === null
        ? [subjectId, actionType]
        : [subjectId, actionType, currentSourceBlock],
    stateStatus: "accepted",
  });

  console.log(JSON.stringify(toPlainJsonValue(result), null, 2));
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
