#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const bridgeReceiverAddress =
  process.env.BRIDGE_RECEIVER_IC_ADDRESS || process.argv[2];
const relayerAddress = process.env.RELAYER_ADDRESS || process.argv[3];
const authorizedFlag = (process.env.AUTHORIZED || process.argv[4] || "true").toLowerCase();

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!bridgeReceiverAddress) {
  throw new Error("Missing BRIDGE_RECEIVER_IC_ADDRESS env var or argv[2]");
}
if (!relayerAddress) {
  throw new Error("Missing RELAYER_ADDRESS env var or argv[3]");
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
  const authorized = parseAuthorizedFlag(authorizedFlag);

  console.log("Setting bridge relayer authorization:");
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Owner wallet: ${account.address}`);
  console.log(`  BridgeReceiver: ${bridgeReceiverAddress}`);
  console.log(`  Relayer: ${relayerAddress}`);
  console.log(`  Authorized: ${authorized}`);

  const hash = await client.writeContract({
    address: bridgeReceiverAddress as `0x${string}`,
    functionName: "set_authorized_relayer",
    args: [relayerAddress, authorized],
  });

  console.log(`TX: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 30,
  });

  console.log(`Status: ${receipt.status}`);
  console.log("Done - relayer authorization updated");
}

function parseAuthorizedFlag(value: string): boolean {
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  throw new Error(`Invalid authorized flag: ${value}`);
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
