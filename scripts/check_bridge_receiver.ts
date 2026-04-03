#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}

const normalizedPrivateKey = normalizePrivateKey(privateKey);
const account = createAccount(normalizedPrivateKey);
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
  console.log(`Checking RJP bridge receiver: ${rjpAddress}`);

  const bridgeReceiver = await client.readContract({
    address: rjpAddress as `0x${string}`,
    functionName: "get_bridge_receiver",
    args: [],
    stateStatus: "accepted",
  });

  console.log(`Bridge receiver: ${bridgeReceiver}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}
