#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const bridgeReceiverAddress =
  process.env.BRIDGE_RECEIVER_IC_ADDRESS || process.argv[3];

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!bridgeReceiverAddress) {
  throw new Error("Missing BRIDGE_RECEIVER_IC_ADDRESS env var or argv[3]");
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
  console.log("Setting bridge receiver on RJP:");
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Wallet: ${account.address}`);
  console.log(`  RJP: ${rjpAddress}`);
  console.log(`  BridgeReceiver: ${bridgeReceiverAddress}`);

  const hash = await client.writeContract({
    address: rjpAddress as `0x${string}`,
    functionName: "set_bridge_receiver",
    args: [bridgeReceiverAddress],
  });

  console.log(`TX: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 30,
  });

  console.log(`Status: ${receipt.status}`);
  console.log("Done - bridge receiver set");
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
