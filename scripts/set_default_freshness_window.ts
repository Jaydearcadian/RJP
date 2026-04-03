#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const freshnessWindowBlocksRaw =
  process.env.DEFAULT_FRESHNESS_WINDOW_BLOCKS || process.argv[3];

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!freshnessWindowBlocksRaw) {
  throw new Error("Missing DEFAULT_FRESHNESS_WINDOW_BLOCKS env var or argv[3]");
}

const freshnessWindowBlocks = Number(freshnessWindowBlocksRaw);
if (!Number.isFinite(freshnessWindowBlocks) || freshnessWindowBlocks < 0) {
  throw new Error("DEFAULT_FRESHNESS_WINDOW_BLOCKS must be a non-negative number");
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
  console.log("Setting default freshness window on RJP:");
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Wallet: ${account.address}`);
  console.log(`  RJP: ${rjpAddress}`);
  console.log(`  Freshness window: ${freshnessWindowBlocks}`);

  const hash = await client.writeContract({
    address: rjpAddress as `0x${string}`,
    functionName: "set_default_freshness_window_blocks",
    args: [freshnessWindowBlocks],
  });

  await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 100,
  });

  console.log(JSON.stringify({ txHash: hash, freshness_window_blocks: freshnessWindowBlocks }, null, 2));
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
