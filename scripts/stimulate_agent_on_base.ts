#!/usr/bin/env npx tsx

import { createPublicClient, createWalletClient, decodeEventLog, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const basePrivateKey = process.env.BASE_PRIVATE_KEY || process.argv[2];
const demoAddress = process.env.BASE_AGENT_DEMO_ADDRESS || process.argv[3];
const subjectId = process.env.SUBJECT_ID || process.argv[4];
const actionType = process.env.ACTION_TYPE || process.argv[5] || "trade";

if (!basePrivateKey) {
  throw new Error("Missing BASE_PRIVATE_KEY env var or argv[2]");
}
if (!demoAddress) {
  throw new Error("Missing BASE_AGENT_DEMO_ADDRESS env var or argv[3]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[4]");
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

const demoAbi = [
  {
    type: "function",
    name: "previewActionHandshake",
    stateMutability: "view",
    inputs: [
      { name: "subjectId", type: "string" },
      { name: "actionType", type: "string" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "state", type: "string" },
          { name: "recommendedAction", type: "string" },
          { name: "reasonCode", type: "string" },
          { name: "reason", type: "string" },
          { name: "allowed", type: "bool" },
          { name: "caseId", type: "string" },
          { name: "claimType", type: "string" },
          { name: "outcome", type: "string" },
          { name: "revision", type: "uint64" },
          { name: "validUntilSourceBlock", type: "uint64" },
          { name: "freshnessWindowBlocks", type: "uint32" },
          { name: "summary", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "attemptAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectId", type: "string" },
      { name: "actionType", type: "string" },
    ],
    outputs: [{ name: "allowed", type: "bool" }],
  },
  {
    type: "function",
    name: "getLatestAction",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "actor", type: "address" },
          { name: "subjectId", type: "string" },
          { name: "actionType", type: "string" },
          { name: "allowed", type: "bool" },
          { name: "state", type: "string" },
          { name: "recommendedAction", type: "string" },
          { name: "reasonCode", type: "string" },
          { name: "reason", type: "string" },
          { name: "caseId", type: "string" },
          { name: "claimType", type: "string" },
          { name: "outcome", type: "string" },
          { name: "revision", type: "uint64" },
          { name: "validUntilSourceBlock", type: "uint64" },
          { name: "freshnessWindowBlocks", type: "uint32" },
          { name: "summary", type: "string" },
          { name: "recordedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "ActionEvaluated",
    inputs: [
      { indexed: true, name: "actionId", type: "uint256" },
      { indexed: true, name: "actor", type: "address" },
      { indexed: false, name: "subjectId", type: "string" },
      { indexed: false, name: "actionType", type: "string" },
      { indexed: false, name: "allowed", type: "bool" },
      { indexed: false, name: "state", type: "string" },
      { indexed: false, name: "reasonCode", type: "string" },
      { indexed: false, name: "reason", type: "string" },
      { indexed: false, name: "outcome", type: "string" },
      { indexed: false, name: "revision", type: "uint64" },
    ],
    anonymous: false,
  },
] as const;

async function main() {
  console.log("Stimulating Base Sepolia agent consumer:");
  console.log(`  Agent wallet: ${account.address}`);
  console.log(`  Demo: ${demoAddress}`);
  console.log(`  Subject: ${subjectId}`);
  console.log(`  Action: ${actionType}`);

  const preview = await basePublicClient.readContract({
    address: demoAddress as `0x${string}`,
    abi: demoAbi,
    functionName: "previewActionHandshake",
    args: [subjectId, actionType],
  });

  const hash = await baseWalletClient.writeContract({
    address: demoAddress as `0x${string}`,
    abi: demoAbi,
    functionName: "attemptAction",
    args: [subjectId, actionType],
    chain: baseSepolia,
    account,
  });

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash });
  const event = receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({
          abi: demoAbi,
          eventName: "ActionEvaluated",
          data: log.data,
          topics: log.topics,
        });
      } catch {
        return null;
      }
    })
    .find(Boolean);

  const latest = await basePublicClient.readContract({
    address: demoAddress as `0x${string}`,
    abi: demoAbi,
    functionName: "getLatestAction",
  });

  console.log(
    JSON.stringify(
      {
        txHash: hash,
        blockNumber: Number(receipt.blockNumber),
        previewHandshake: {
          state: preview.state,
          recommended_action: preview.recommendedAction,
          reason_code: preview.reasonCode,
          reason: preview.reason,
          allowed: preview.allowed,
          case_id: preview.caseId,
          claim_type: preview.claimType,
          outcome: preview.outcome,
          revision: Number(preview.revision),
          valid_until_source_block: Number(preview.validUntilSourceBlock),
          freshness_window_blocks: Number(preview.freshnessWindowBlocks),
          summary: preview.summary,
        },
        event: event
          ? {
              actionId: Number((event as any).args.actionId),
              actor: (event as any).args.actor,
              subjectId: (event as any).args.subjectId,
              actionType: (event as any).args.actionType,
              allowed: (event as any).args.allowed,
              state: (event as any).args.state,
              reasonCode: (event as any).args.reasonCode,
              reason: (event as any).args.reason,
              outcome: (event as any).args.outcome,
              revision: Number((event as any).args.revision),
            }
          : null,
        latestGlobalAction: {
          actor: latest.actor,
          subject_id: latest.subjectId,
          action_type: latest.actionType,
          allowed: latest.allowed,
          state: latest.state,
          recommended_action: latest.recommendedAction,
          reason_code: latest.reasonCode,
          reason: latest.reason,
          case_id: latest.caseId,
          claim_type: latest.claimType,
          outcome: latest.outcome,
          revision: Number(latest.revision),
          valid_until_source_block: Number(latest.validUntilSourceBlock),
          freshness_window_blocks: Number(latest.freshnessWindowBlocks),
          summary: latest.summary,
          recorded_at: Number(latest.recordedAt),
        },
        latestGlobalActionNote:
          "getLatestAction() is the contract-wide last recorded action, not a subject-filtered lookup.",
      },
      null,
      2,
    ),
  );
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
