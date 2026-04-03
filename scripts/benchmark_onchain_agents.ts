#!/usr/bin/env npx tsx

import { performance } from "node:perf_hooks";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { interpretHandshakeDomain } from "./lib/domain_interpretation.js";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const basePrivateKey = process.env.BASE_PRIVATE_KEY || process.argv[2];
const judgmentDemoAddress = process.env.BASE_AGENT_DEMO_ADDRESS || process.argv[3];
const directDemoAddress = process.env.BASE_AGENT_DIRECT_ADDRESS || process.argv[4];
const subjectIdsRaw =
  process.env.SUBJECT_IDS ||
  process.env.SUBJECTS ||
  process.env.SUBJECT_ID ||
  process.argv[5];
const actionType = process.env.ACTION_TYPE || process.argv[6] || "trade";
const rounds = Number(process.env.ROUNDS || "3");

if (!basePrivateKey) {
  throw new Error("Missing BASE_PRIVATE_KEY env var or argv[2]");
}
if (!judgmentDemoAddress) {
  throw new Error("Missing BASE_AGENT_DEMO_ADDRESS env var or argv[3]");
}
if (!directDemoAddress) {
  throw new Error("Missing BASE_AGENT_DIRECT_ADDRESS env var or argv[4]");
}
if (!subjectIdsRaw) {
  throw new Error("Missing SUBJECT_ID, SUBJECT_IDS, SUBJECTS env var or argv[5]");
}
if (!Number.isFinite(rounds) || rounds <= 0) {
  throw new Error("ROUNDS must be a positive number");
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

type JudgmentPreview = {
  state: string;
  recommendedAction: string;
  reasonCode: string;
  reason: string;
  allowed: boolean;
  caseId: string;
  claimType: string;
  outcome: string;
  revision: bigint;
  validUntilSourceBlock: bigint;
  freshnessWindowBlocks: number;
  summary: string;
};

type DirectPreview = {
  state: string;
  recommendedAction: string;
  reasonCode: string;
  reason: string;
  allowed: boolean;
};

const judgmentAbi = [
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
];

const directAbi = [
  {
    type: "function",
    name: "previewAction",
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
];

async function main() {
  let nextNonce = await basePublicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  const results: Array<Record<string, unknown>> = [];

  for (const subjectId of subjectIds) {
    const judgmentReadSamples: number[] = [];
    const judgmentWriteSamples: number[] = [];
    const directReadSamples: number[] = [];
    const directWriteSamples: number[] = [];
    let latestJudgmentPreview: Record<string, unknown> = {};
    let latestDirectPreview: Record<string, unknown> = {};
    const judgmentTxs: string[] = [];
    const directTxs: string[] = [];

    for (let round = 0; round < rounds; round += 1) {
      const judgmentReadStartedAt = performance.now();
      const judgmentPreview = (await basePublicClient.readContract({
        address: judgmentDemoAddress as `0x${string}`,
        abi: judgmentAbi,
        functionName: "previewActionHandshake",
        args: [subjectId, actionType],
      } as any)) as JudgmentPreview;
      judgmentReadSamples.push(Math.round(performance.now() - judgmentReadStartedAt));
      latestJudgmentPreview = {
        state: judgmentPreview.state,
        recommended_action: judgmentPreview.recommendedAction,
        reason_code: judgmentPreview.reasonCode,
        reason: judgmentPreview.reason,
        allowed: judgmentPreview.allowed,
        case_id: judgmentPreview.caseId,
        claim_type: judgmentPreview.claimType,
        outcome: judgmentPreview.outcome,
        revision: Number(judgmentPreview.revision),
        valid_until_source_block: Number(judgmentPreview.validUntilSourceBlock),
        freshness_window_blocks: Number(judgmentPreview.freshnessWindowBlocks),
        summary: judgmentPreview.summary,
        domain_interpretation: interpretHandshakeDomain({
          domain_id: judgmentPreview.caseId.startsWith("protocol_safety.")
            ? "protocol_safety.base_erc20_permission_v1"
            : judgmentPreview.caseId.startsWith("counterparty_trust.")
              ? "counterparty_trust.base_trade_v1"
              : "",
          claim_type: judgmentPreview.claimType,
          case_id: judgmentPreview.caseId,
          outcome: judgmentPreview.outcome,
          state: judgmentPreview.state,
          recommended_action: judgmentPreview.recommendedAction,
          reason_code: judgmentPreview.reasonCode,
          summary: judgmentPreview.summary,
        }),
      };

      const judgmentWriteStartedAt = performance.now();
      const judgmentHash = await baseWalletClient.writeContract({
        address: judgmentDemoAddress as `0x${string}`,
        abi: judgmentAbi,
        functionName: "attemptAction",
        args: [subjectId, actionType],
        chain: baseSepolia,
        account,
        nonce: nextNonce,
      });
      nextNonce += 1;
      await basePublicClient.waitForTransactionReceipt({ hash: judgmentHash });
      judgmentWriteSamples.push(Math.round(performance.now() - judgmentWriteStartedAt));
      judgmentTxs.push(judgmentHash);

      const directReadStartedAt = performance.now();
      const directPreview = (await basePublicClient.readContract({
        address: directDemoAddress as `0x${string}`,
        abi: directAbi,
        functionName: "previewAction",
        args: [subjectId, actionType],
      } as any)) as DirectPreview;
      directReadSamples.push(Math.round(performance.now() - directReadStartedAt));
      latestDirectPreview = {
        state: directPreview.state,
        recommended_action: directPreview.recommendedAction,
        reason_code: directPreview.reasonCode,
        reason: directPreview.reason,
        allowed: directPreview.allowed,
      };

      const directWriteStartedAt = performance.now();
      const directHash = await baseWalletClient.writeContract({
        address: directDemoAddress as `0x${string}`,
        abi: directAbi,
        functionName: "attemptAction",
        args: [subjectId, actionType],
        chain: baseSepolia,
        account,
        nonce: nextNonce,
      });
      nextNonce += 1;
      await basePublicClient.waitForTransactionReceipt({ hash: directHash });
      directWriteSamples.push(Math.round(performance.now() - directWriteStartedAt));
      directTxs.push(directHash);
    }

    results.push({
      subject_id: subjectId,
      judgment_agent: {
        preview: latestJudgmentPreview,
        read_latency_ms: summarizeSamples(judgmentReadSamples),
        write_latency_ms: summarizeSamples(judgmentWriteSamples),
        tx_hashes: judgmentTxs,
      },
      direct_agent: {
        preview: latestDirectPreview,
        read_latency_ms: summarizeSamples(directReadSamples),
        write_latency_ms: summarizeSamples(directWriteSamples),
        tx_hashes: directTxs,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        config: {
          rounds,
          subject_ids: subjectIds,
          action_type: actionType,
          judgment_demo_address: judgmentDemoAddress,
          direct_demo_address: directDemoAddress,
        },
        results,
      },
      null,
      2,
    ),
  );
}

function summarizeSamples(samples: number[]) {
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...samples),
    max: Math.max(...samples),
    avg: Math.round(total / samples.length),
    samples,
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
