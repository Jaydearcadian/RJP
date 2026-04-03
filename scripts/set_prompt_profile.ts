#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const promptProfile = (process.env.PROMPT_PROFILE || process.argv[3] || "").trim();

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!promptProfile) {
  throw new Error("Missing PROMPT_PROFILE env var or argv[3]");
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
  console.log("Updating prompt profile:");
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Wallet: ${account.address}`);
  console.log(`  RJP: ${rjpAddress}`);
  console.log(`  Prompt profile: ${promptProfile}`);

  const hash = await client.writeContract({
    address: rjpAddress as `0x${string}`,
    functionName: "set_prompt_profile",
    args: [promptProfile],
  } as any);

  console.log(`TX: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 100,
  } as any);

  console.log(`Status: ${receipt.status}`);
  console.log("Done - prompt profile updated");
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
