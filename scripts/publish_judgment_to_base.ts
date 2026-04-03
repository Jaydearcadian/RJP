#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { toPlainJsonValue } from "./lib/format_genlayer_result.js";

const genlayerPrivateKey = process.env.PRIVATE_KEY;
const genlayerRpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const subjectId = process.env.SUBJECT_ID || process.argv[3];
const baseMirrorAddress = process.env.BASE_MIRROR_ADDRESS || process.argv[4];
const basePrivateKey = process.env.BASE_PRIVATE_KEY || process.argv[5];
const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";

if (!genlayerPrivateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[3]");
}
if (!baseMirrorAddress) {
  throw new Error("Missing BASE_MIRROR_ADDRESS env var or argv[4]");
}
if (!basePrivateKey) {
  throw new Error("Missing BASE_PRIVATE_KEY env var or argv[5]");
}

const genlayerAccount = createAccount(normalizePrivateKey(genlayerPrivateKey));
const genlayerClient = createClient({
  chain: {
    ...studionet,
    rpcUrls: {
      default: { http: [genlayerRpcUrl] },
    },
  },
  account: genlayerAccount,
});

const baseAccount = privateKeyToAccount(normalizePrivateKey(basePrivateKey));
const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});
const baseWalletClient = createWalletClient({
  account: baseAccount,
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

const mirrorAbi = [
  {
    type: "function",
    name: "publishJudgment",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "input",
        type: "tuple",
        components: [
          { name: "subjectId", type: "string" },
          { name: "domainId", type: "string" },
          { name: "caseId", type: "string" },
          { name: "claimType", type: "string" },
          { name: "revision", type: "uint64" },
          { name: "outcome", type: "string" },
          { name: "confidencePpm", type: "uint32" },
          { name: "freshnessWindowBlocks", type: "uint32" },
          { name: "validUntilSourceBlock", type: "uint64" },
          { name: "assessmentHash", type: "bytes32" },
          { name: "caseHash", type: "bytes32" },
          { name: "evidenceAnchorHash", type: "bytes32" },
          { name: "sourceNetwork", type: "string" },
          { name: "sourceChainId", type: "uint64" },
          { name: "riskFlagsJson", type: "string" },
          { name: "summary", type: "string" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

async function main() {
  const judgmentRaw = await genlayerClient.readContract({
    address: rjpAddress as `0x${string}`,
    functionName: "get_latest_judgment",
    args: [subjectId],
    stateStatus: "accepted",
  });
  const judgment = toPlainJsonValue(judgmentRaw) as Record<string, unknown>;

  if (!judgment.exists) {
    throw new Error(`No latest judgment found for ${subjectId}`);
  }

  const riskFlagsJson = JSON.stringify(judgment.risk_flags ?? []);
  const data = encodeFunctionData({
    abi: mirrorAbi,
    functionName: "publishJudgment",
    args: [
      {
        subjectId: String(judgment.subject_id),
        domainId: String(judgment.domain_id),
        caseId: String(judgment.case_id ?? ""),
        claimType: String(judgment.claim_type ?? ""),
        revision: BigInt(Number(judgment.revision)),
        outcome: String(judgment.outcome),
        confidencePpm: Number(judgment.confidence_ppm),
        freshnessWindowBlocks: Number(judgment.freshness_window_blocks),
        validUntilSourceBlock: BigInt(Number(judgment.valid_until_source_block)),
        assessmentHash: toBytes32Commitment(String(judgment.assessment_hash)),
        caseHash: toBytes32Commitment(String(judgment.case_hash)),
        evidenceAnchorHash: toBytes32Commitment(String(judgment.evidence_anchor)),
        sourceNetwork: String(judgment.source_network),
        sourceChainId: BigInt(Number(judgment.source_chain_id)),
        riskFlagsJson,
        summary: String(judgment.summary),
      },
    ],
  });

  console.log("Publishing latest GenLayer judgment to Base Sepolia:");
  console.log(`  Subject: ${subjectId}`);
  console.log(`  RJP: ${rjpAddress}`);
  console.log(`  Mirror: ${baseMirrorAddress}`);
  console.log(`  Base wallet: ${baseAccount.address}`);

  const hash = await baseWalletClient.sendTransaction({
    account: baseAccount,
    to: baseMirrorAddress as `0x${string}`,
    data,
    value: 0n,
  });

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash });
  console.log(JSON.stringify({ txHash: hash, blockNumber: Number(receipt.blockNumber) }, null, 2));
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}

function toBytes32Commitment(value: string): `0x${string}` {
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]{1,64}$/.test(trimmed)) {
    return `0x${trimmed.slice(2).padStart(64, "0")}` as `0x${string}`;
  }
  return keccak256(stringToHex(trimmed));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
