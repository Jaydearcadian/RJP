#!/usr/bin/env npx tsx

import { performance } from "node:perf_hooks";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const basePrivateKey = process.env.BASE_PRIVATE_KEY || process.argv[2];
const demoAddress = process.env.BASE_AGENT_DEMO_ADDRESS || process.argv[3];
const actionType = process.env.ACTION_TYPE || process.argv[4] || "trade";
const subjectIdsRaw =
  process.env.SUBJECT_IDS ||
  process.env.SUBJECTS ||
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c";

if (!basePrivateKey) {
  throw new Error("Missing BASE_PRIVATE_KEY env var or argv[2]");
}
if (!demoAddress) {
  throw new Error("Missing BASE_AGENT_DEMO_ADDRESS env var or argv[3]");
}

const subjectIds = subjectIdsRaw
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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
] as const;

const agentProfiles = [
  "JudgmentScout",
  "ExecutionRouter",
  "CounterpartyGuard",
  "RiskDesk",
  "SwarmRouter",
  "PolicySentinel",
];

async function main() {
  let nextNonce = await basePublicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  const rows: Array<Record<string, unknown>> = [];

  for (const subjectId of subjectIds) {
    for (const agentName of agentProfiles) {
      const receiveStartedAt = performance.now();
      const preview = await basePublicClient.readContract({
        address: demoAddress as `0x${string}`,
        abi: demoAbi,
        functionName: "previewActionHandshake",
        args: [subjectId, actionType],
      });
      const receiveMs = Math.round(performance.now() - receiveStartedAt);

      const interpretStartedAt = performance.now();
      const decision = interpretPreview(preview);
      const interpretMs = Math.round(performance.now() - interpretStartedAt);

      const settleStartedAt = performance.now();
      const txHash = await baseWalletClient.writeContract({
        address: demoAddress as `0x${string}`,
        abi: demoAbi,
        functionName: "attemptAction",
        args: [subjectId, actionType],
        chain: baseSepolia,
        account,
        nonce: nextNonce,
      });
      nextNonce += 1;
      const receipt = await basePublicClient.waitForTransactionReceipt({ hash: txHash });
      const settleMs = Math.round(performance.now() - settleStartedAt);

      rows.push({
        agent_name: agentName,
        subject_id: subjectId,
        receive_ms: receiveMs,
        interpret_ms: interpretMs,
        decision,
        onchain_preview: {
          state: preview.state,
          recommended_action: preview.recommendedAction,
          reason_code: preview.reasonCode,
          allowed: preview.allowed,
          outcome: preview.outcome,
          revision: Number(preview.revision),
          valid_until_source_block: Number(preview.validUntilSourceBlock),
        },
        settle_ms: settleMs,
        tx_hash: txHash,
        block_number: Number(receipt.blockNumber),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        config: {
          actor: account.address,
          subject_ids: subjectIds,
          action_type: actionType,
          base_agent_demo_address: demoAddress,
          agent_count: agentProfiles.length,
        },
        summary: {
          total_runs: rows.length,
          receive_ms: summarize(rows.map((row) => Number(row.receive_ms))),
          interpret_ms: summarize(rows.map((row) => Number(row.interpret_ms))),
          settle_ms: summarize(rows.map((row) => Number(row.settle_ms))),
        },
        results: rows,
      },
      null,
      2,
    ),
  );
}

function interpretPreview(preview: {
  state: string;
  recommendedAction: string;
  reasonCode: string;
  reason: string;
  allowed: boolean;
  outcome: string;
}) {
  const decision = preview.allowed
    ? "ALLOW"
    : preview.state === "STALE"
      ? "REFRESH"
      : "DENY";

  return {
    decision,
    allowed: preview.allowed,
    handshake_state: preview.state,
    recommended_action_hint: preview.recommendedAction,
    reason_code: preview.reasonCode,
    reason: preview.reason,
    outcome: preview.outcome,
  };
}

function summarize(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round(total / values.length),
    samples: values,
  };
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
