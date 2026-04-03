#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const bridgeReceiver = process.env.BRIDGE_RECEIVER_IC_ADDRESS || process.argv[2] || "";
const evaluationMode = (process.env.EVALUATION_MODE || process.argv[3] || "deterministic").trim();
const defaultFreshnessWindowBlocks = Number(
  process.env.DEFAULT_FRESHNESS_WINDOW_BLOCKS || process.argv[4] || "50000",
);
const promptProfile = (process.env.PROMPT_PROFILE || process.argv[5] || "standard").trim();

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
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
  const contractPath = path.resolve("contracts/reasoned_judgment_pass.py");
  const contractCode = new Uint8Array(readFileSync(contractPath));

  console.log("Deploying ReasonedJudgmentPass to Studionet:");
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Wallet: ${account.address}`);
  console.log(`  Contract: ${contractPath}`);
  console.log(`  Bridge receiver arg: ${bridgeReceiver || "(default owner)"}`);
  console.log(`  Evaluation mode arg: ${evaluationMode}`);
  console.log(`  Freshness window arg: ${defaultFreshnessWindowBlocks}`);
  console.log(`  Prompt profile arg: ${promptProfile}`);

  await client.initializeConsensusSmartContract();

  const deployHash = await client.deployContract({
    code: contractCode,
    args: bridgeReceiver
      ? [bridgeReceiver, evaluationMode, defaultFreshnessWindowBlocks, promptProfile]
      : ["", evaluationMode, defaultFreshnessWindowBlocks, promptProfile],
  });

  console.log(`deploy TX: ${deployHash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: deployHash,
    status: "ACCEPTED",
    retries: 200,
  } as any);

  const contractAddress = receipt.data?.contract_address;
  if (!contractAddress) {
    throw new Error(`Deployment failed to return a contract address. Receipt: ${JSON.stringify(receipt)}`);
  }

  const deployment = {
    contract: "ReasonedJudgmentPass",
    network: "studionet",
    rpc_url: rpcUrl,
    address: contractAddress,
    deployment_hash: deployHash,
    wallet: account.address,
    args: {
      bridge_receiver: bridgeReceiver || "",
      evaluation_mode: evaluationMode,
      default_freshness_window_blocks: defaultFreshnessWindowBlocks,
      prompt_profile: promptProfile,
    },
    timestamp: new Date().toISOString(),
  };

  const outDir = path.resolve("deployments/studionet");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "ReasonedJudgmentPass.current.json");
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(JSON.stringify(deployment, null, 2));
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
