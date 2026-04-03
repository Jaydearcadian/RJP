#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const evaluationMode = (process.env.EVALUATION_MODE || process.argv[3] || "").trim();

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!evaluationMode) {
  throw new Error("Missing EVALUATION_MODE env var or argv[3]");
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
  console.log("Updating evaluation mode:");
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Wallet: ${account.address}`);
  console.log(`  RJP: ${rjpAddress}`);
  console.log(`  Mode: ${evaluationMode}`);

  const hash = await client.writeContract({
    address: rjpAddress as `0x${string}`,
    functionName: "set_evaluation_mode",
    args: [evaluationMode],
  });

  console.log(`TX: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 100,
  });

  console.log(`Status: ${receipt.status}`);
  console.log("Done - evaluation mode updated");
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
