#!/usr/bin/env npx tsx

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const baseMirrorAddress = process.env.BASE_MIRROR_ADDRESS || process.argv[2];
const basePrivateKey = process.env.BASE_PRIVATE_KEY || process.argv[3];
const publisherAddress = process.env.PUBLISHER_ADDRESS || process.argv[4];
const authorizedRaw = process.env.AUTHORIZED || process.argv[5] || "true";

if (!baseMirrorAddress) {
  throw new Error("Missing BASE_MIRROR_ADDRESS env var or argv[2]");
}
if (!basePrivateKey) {
  throw new Error("Missing BASE_PRIVATE_KEY env var or argv[3]");
}
if (!publisherAddress) {
  throw new Error("Missing PUBLISHER_ADDRESS env var or argv[4]");
}

const account = privateKeyToAccount(normalizePrivateKey(basePrivateKey));
const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});
const baseWalletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

const mirrorAbi = [
  {
    type: "function",
    name: "setPublisher",
    stateMutability: "nonpayable",
    inputs: [
      { name: "publisher", type: "address" },
      { name: "authorized", type: "bool" },
    ],
    outputs: [],
  },
] as const;

async function main() {
  const authorized = parseBoolean(authorizedRaw);
  console.log("Updating Base mirror publisher:");
  console.log(`  Mirror: ${baseMirrorAddress}`);
  console.log(`  Owner wallet: ${account.address}`);
  console.log(`  Publisher: ${publisherAddress}`);
  console.log(`  Authorized: ${authorized}`);

  const hash = await baseWalletClient.writeContract({
    address: baseMirrorAddress as `0x${string}`,
    abi: mirrorAbi,
    functionName: "setPublisher",
    args: [publisherAddress as `0x${string}`, authorized],
    chain: baseSepolia,
    account,
  });

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash });
  console.log(JSON.stringify({ txHash: hash, blockNumber: Number(receipt.blockNumber) }, null, 2));
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`Invalid AUTHORIZED value: ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
