#!/usr/bin/env npx tsx

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const txHash = (process.env.TX_HASH || process.argv[2] || "").trim();
const status = (process.env.TX_STATUS || process.argv[3] || "ACCEPTED").trim();
const fullTransaction = String(process.env.FULL_TRANSACTION || "true").trim().toLowerCase() !== "false";
const retries = Number(process.env.RECEIPT_RETRIES || 5);
const interval = Number(process.env.RECEIPT_INTERVAL_MS || 1000);

if (!txHash) {
  throw new Error("Missing TX_HASH env var or argv[2]");
}

const client = createClient({
  chain: {
    ...studionet,
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  },
});

async function main() {
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    status: status as any,
    retries,
    interval,
    fullTransaction,
  } as any);

  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
