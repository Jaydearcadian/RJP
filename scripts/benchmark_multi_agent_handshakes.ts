#!/usr/bin/env npx tsx

import { performance } from "node:perf_hooks";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

import { toPlainJsonValue } from "./lib/format_genlayer_result.js";
import { interpretHandshakeDomain } from "./lib/domain_interpretation.js";

type Handshake = {
  domain_interpretation?: unknown;
  state?: string;
  recommended_action?: string;
  reason_code?: string;
  reason?: string;
  allowed?: boolean;
  case_id?: string;
  claim_type?: string;
  outcome?: string;
  revision?: number;
  valid_until_source_block?: number;
  freshness_window_blocks?: number;
  summary?: string;
};

type AgentProfile = {
  id: string;
  description: string;
  decide: (handshake: Handshake) => string;
};

type BaseHandshakePreview = {
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
  freshnessWindowBlocks: number | bigint;
  summary: string;
};

const privateKey = process.env.PRIVATE_KEY;
const genlayerRpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const rjpAddress =
  process.env.RJP_CONTRACT_ADDRESS || "0xD3bB89CaFC0986a60C7e4927d9BbD0d53692848C";
const baseAgentDemoAddress =
  process.env.BASE_AGENT_DEMO_ADDRESS || "0x60381D4088B7B2C985B248CE8B64287c13b71434";
const currentSourceBlock = Number(process.env.CURRENT_SOURCE_BLOCK || "39458637");
const rounds = Number(process.env.ROUNDS || "3");
const actionType = process.env.ACTION_TYPE || "trade";
const subjectsRaw =
  process.env.SUBJECTS ||
  [
    "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
    "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c",
    "0x0000000000000000000000000000000000000d0d",
  ].join(",");

const subjectLabels: Record<string, string> = {
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001": "SAFE",
  "0x0000000000000000000000000000000000000ca7": "CAUTION",
  "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c": "UNSAFE",
  "0x0000000000000000000000000000000000000d0d": "NO_JUDGMENT",
};

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!Number.isFinite(currentSourceBlock)) {
  throw new Error("CURRENT_SOURCE_BLOCK must be a finite number");
}
if (!Number.isFinite(rounds) || rounds <= 0) {
  throw new Error("ROUNDS must be a positive number");
}

const subjects = subjectsRaw
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const account = createAccount(normalizePrivateKey(privateKey));
const genlayerClient = createClient({
  chain: {
    ...studionet,
    rpcUrls: {
      default: { http: [genlayerRpcUrl] },
    },
  },
  account,
});

const baseClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

const baseDemoAbi = [
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
] as const;

const agents: AgentProfile[] = [
  {
    id: "policy_follower",
    description: "Follows the protocol recommended_action exactly.",
    decide: (handshake) => handshake.recommended_action || "UNKNOWN",
  },
  {
    id: "cautious_wallet",
    description: "Allows only SAFE, escalates CAUTION, refreshes stale or missing state.",
    decide: (handshake) => {
      switch (handshake.state) {
        case "SAFE":
          return "ALLOW";
        case "CAUTION":
          return "ESCALATE_TO_HUMAN";
        case "STALE":
        case "NO_JUDGMENT":
        case "INSUFFICIENT_DATA":
          return "REFRESH_BEFORE_SIGN";
        default:
          return "DENY";
      }
    },
  },
  {
    id: "throughput_router",
    description: "Routes SAFE immediately, queues reviewable states, blocks unsafe.",
    decide: (handshake) => {
      switch (handshake.state) {
        case "SAFE":
          return "ROUTE_NOW";
        case "CAUTION":
          return "QUEUE_REVIEW";
        case "STALE":
        case "NO_JUDGMENT":
        case "INSUFFICIENT_DATA":
          return "REQUERY";
        default:
          return "BLOCK_ROUTE";
      }
    },
  },
  {
    id: "hint_ignorer",
    description: "Ignores the policy hint and tries to proceed anyway in advisory tests.",
    decide: () => "TRY_ANYWAY",
  },
];

async function main() {
  const report: Record<string, unknown> = {
    config: {
      rounds,
      action_type: actionType,
      current_source_block: currentSourceBlock,
      rjp_address: rjpAddress,
      base_agent_demo_address: baseAgentDemoAddress,
      subjects,
    },
    agents: agents.map((agent) => ({
      id: agent.id,
      description: agent.description,
    })),
    results: [],
  };

  for (const subjectId of subjects) {
    const genlayerSamples: number[] = [];
    const baseSamples: number[] = [];
    let latestGenlayer: Handshake = {};
    let latestBase: Handshake = {};

    for (let round = 0; round < rounds; round += 1) {
      const genlayerStartedAt = performance.now();
      const genlayerHandshakeRaw = await genlayerClient.readContract(({
        address: rjpAddress as `0x${string}`,
        functionName: "get_handshake_state_with_source_block",
        args: [subjectId, actionType, currentSourceBlock],
        stateStatus: "accepted",
      } as any));
      const genlayerMs = performance.now() - genlayerStartedAt;
      latestGenlayer = toPlainJsonValue(genlayerHandshakeRaw) as Handshake;
      genlayerSamples.push(Math.round(genlayerMs));

      const baseStartedAt = performance.now();
      const baseHandshakeRaw = (await baseClient.readContract(({
        address: baseAgentDemoAddress as `0x${string}`,
        abi: baseDemoAbi,
        functionName: "previewActionHandshake",
        args: [subjectId, actionType],
      } as any))) as BaseHandshakePreview;
      const baseMs = performance.now() - baseStartedAt;
      latestBase = {
        state: baseHandshakeRaw.state,
        recommended_action: baseHandshakeRaw.recommendedAction,
        reason_code: baseHandshakeRaw.reasonCode,
        reason: baseHandshakeRaw.reason,
        allowed: baseHandshakeRaw.allowed,
        case_id: baseHandshakeRaw.caseId,
        claim_type: baseHandshakeRaw.claimType,
        outcome: baseHandshakeRaw.outcome,
        revision: Number(baseHandshakeRaw.revision),
        valid_until_source_block: Number(baseHandshakeRaw.validUntilSourceBlock),
        freshness_window_blocks: Number(baseHandshakeRaw.freshnessWindowBlocks),
        summary: baseHandshakeRaw.summary,
        domain_interpretation: interpretHandshakeDomain({
          domain_id: baseHandshakeRaw.caseId.startsWith("protocol_safety.")
            ? "protocol_safety.base_erc20_permission_v1"
            : baseHandshakeRaw.caseId.startsWith("counterparty_trust.")
              ? "counterparty_trust.base_trade_v1"
              : "",
          claim_type: baseHandshakeRaw.claimType,
          case_id: baseHandshakeRaw.caseId,
          outcome: baseHandshakeRaw.outcome,
          state: baseHandshakeRaw.state,
          recommended_action: baseHandshakeRaw.recommendedAction,
          reason_code: baseHandshakeRaw.reasonCode,
          summary: baseHandshakeRaw.summary,
        }),
      };
      baseSamples.push(Math.round(baseMs));
    }

    const agentResults = agents.map((agent) => ({
      id: agent.id,
      genlayer_decision: agent.decide(latestGenlayer),
      base_decision: agent.decide(latestBase),
    }));

    (report.results as Array<Record<string, unknown>>).push({
      subject_id: subjectId,
      expected_state: subjectLabels[subjectId] || "UNKNOWN",
      genlayer_handshake: latestGenlayer,
      base_handshake: latestBase,
      latency_ms: {
        genlayer: summarizeSamples(genlayerSamples),
        base: summarizeSamples(baseSamples),
      },
      agents: agentResults,
    });
  }

  console.log(JSON.stringify(report, null, 2));
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
