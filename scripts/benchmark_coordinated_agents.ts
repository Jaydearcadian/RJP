#!/usr/bin/env npx tsx

import { performance } from "node:perf_hooks";

import { createPublicClient, http, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { canonicalizeJson } from "./lib/canonical_json.js";
import { interpretJudgmentDomain } from "./lib/domain_interpretation.js";

type MirrorJudgment = {
  subject_id: string;
  domain_id: string;
  case_id: string;
  claim_type: string;
  revision: number;
  outcome: string;
  confidence_ppm: number;
  freshness_window_blocks: number;
  valid_until_source_block: number;
  assessment_hash: string;
  case_hash: string;
  evidence_anchor_hash: string;
  source_network: string;
  source_chain_id: number;
  risk_flags: string[];
  summary: string;
  published_at: number;
  domain_interpretation?: unknown;
};

type CoordinatedState = "SAFE" | "CAUTION" | "UNSAFE" | "STALE" | "NO_JUDGMENT" | "INSUFFICIENT_DATA";

type AgentProfile = {
  id: string;
  description: string;
  decide: (selfState: CoordinatedState, counterpartyState: CoordinatedState) => string;
};

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const baseMirrorAddress =
  process.env.BASE_MIRROR_ADDRESS || "0x34EBfd4FcC379b14Cdd602485417a5C088228606";
const coordinatorPrivateKey = process.env.COORDINATOR_PRIVATE_KEY;
const rounds = Number(process.env.ROUNDS || "2");
const actionType = process.env.ACTION_TYPE || "trade";
const subjectsRaw =
  process.env.SUBJECTS ||
  [
    "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
    "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c",
  ].join(",");

if (!Number.isFinite(rounds) || rounds <= 0) {
  throw new Error("ROUNDS must be a positive number");
}

const subjects = subjectsRaw
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const baseClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

const mirrorAbi = [
  {
    type: "function",
    name: "getLatestBySubject",
    stateMutability: "view",
    inputs: [{ name: "subjectId", type: "string" }],
    outputs: [
      {
        name: "record",
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
          { name: "publishedAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const subjectLabels: Record<string, string> = {
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001": "SAFE",
  "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c": "UNSAFE",
  "0x0000000000000000000000000000000000000d0d": "NO_JUDGMENT",
  "0x0000000000000000000000000000000000000ca7": "CAUTION",
};

const agents: AgentProfile[] = [
  {
    id: "counterparty_guard",
    description: "Requires both self and counterparty to be SAFE before interacting.",
    decide: (selfState, counterpartyState) => {
      if (selfState === "SAFE" && counterpartyState === "SAFE") {
        return "INTERACT";
      }
      if (selfState === "CAUTION" || counterpartyState === "CAUTION") {
        return "REVIEW";
      }
      if (needsRefresh(selfState) || needsRefresh(counterpartyState)) {
        return "REFRESH";
      }
      return "DENY";
    },
  },
  {
    id: "throughput_matcher",
    description: "Routes quickly to SAFE peers, queues CAUTION, refuses unsafe or stale peers.",
    decide: (selfState, counterpartyState) => {
      if (selfState !== "SAFE") {
        return needsRefresh(selfState) ? "REFRESH_SELF" : "HOLD_SELF";
      }
      switch (counterpartyState) {
        case "SAFE":
          return "ROUTE_NOW";
        case "CAUTION":
          return "QUEUE_REVIEW";
        case "STALE":
        case "NO_JUDGMENT":
        case "INSUFFICIENT_DATA":
          return "REQUERY_COUNTERPARTY";
        default:
          return "BLOCK_COUNTERPARTY";
      }
    },
  },
  {
    id: "reckless_peer",
    description: "Ignores mirrored trust state and proceeds regardless.",
    decide: () => "TRY_ANYWAY",
  },
];

async function main() {
  const currentSourceBlock = Number(await baseClient.getBlockNumber());
  const latencySamples: number[] = [];
  let judgmentsBySubject: Record<string, MirrorJudgment> = {};

  for (let round = 0; round < rounds; round += 1) {
    const startedAt = performance.now();
    judgmentsBySubject = await readAllJudgments(subjects);
    latencySamples.push(Math.round(performance.now() - startedAt));
  }

  const interactions: Array<Record<string, unknown>> = [];
  for (const actorSubject of subjects) {
    for (const counterpartySubject of subjects) {
      if (actorSubject === counterpartySubject) {
        continue;
      }

      const actorJudgment = judgmentsBySubject[actorSubject];
      const counterpartyJudgment = judgmentsBySubject[counterpartySubject];
      const actorState = deriveState(actorJudgment, currentSourceBlock);
      const counterpartyState = deriveState(counterpartyJudgment, currentSourceBlock);

      interactions.push({
        actor_subject: actorSubject,
        counterparty_subject: counterpartySubject,
        actor_expected_label: subjectLabels[actorSubject] || "UNKNOWN",
        counterparty_expected_label: subjectLabels[counterpartySubject] || "UNKNOWN",
        action_type: actionType,
        actor_domain: actorJudgment.domain_id,
        counterparty_domain: counterpartyJudgment.domain_id,
        actor_claim_type: actorJudgment.claim_type,
        counterparty_claim_type: counterpartyJudgment.claim_type,
        actor_state: actorState,
        counterparty_state: counterpartyState,
        actor_summary: actorJudgment.summary,
        counterparty_summary: counterpartyJudgment.summary,
        actor_domain_interpretation: actorJudgment.domain_interpretation,
        counterparty_domain_interpretation: counterpartyJudgment.domain_interpretation,
        agent_decisions: agents.map((agent) => ({
          id: agent.id,
          decision: agent.decide(actorState, counterpartyState),
        })),
      });
    }
  }

  const report = {
    config: {
      rounds,
      action_type: actionType,
      base_mirror_address: baseMirrorAddress,
      current_source_block: currentSourceBlock,
      subjects,
    },
    read_latency_ms: summarizeSamples(latencySamples),
    judgments: judgmentsBySubject,
    agents: agents.map((agent) => ({
      id: agent.id,
      description: agent.description,
    })),
    interactions,
  };

  const canonicalReport = canonicalizeJson(report);
  const reportHash = keccak256(stringToHex(canonicalReport));
  const output: Record<string, unknown> = {
    report,
    attestation: {
      scheme: "eip191-message",
      report_hash: reportHash,
      signer: null,
      signature: null,
      signed_at: null,
    },
  };

  if (coordinatorPrivateKey) {
    const coordinatorAccount = privateKeyToAccount(normalizePrivateKey(coordinatorPrivateKey));
    const signature = await coordinatorAccount.signMessage({
      message: canonicalReport,
    });
    output.attestation = {
      scheme: "eip191-message",
      report_hash: reportHash,
      signer: coordinatorAccount.address,
      signature,
      signed_at: new Date().toISOString(),
    };
  }

  console.log(JSON.stringify(output, null, 2));
}

async function readAllJudgments(subjectIds: string[]) {
  const result: Record<string, MirrorJudgment> = {};

  for (const subjectId of subjectIds) {
    const record = (await baseClient.readContract({
      address: baseMirrorAddress as `0x${string}`,
      abi: mirrorAbi,
      functionName: "getLatestBySubject",
      args: [subjectId],
    } as any)) as {
      subjectId: string;
      domainId: string;
      caseId: string;
      claimType: string;
      revision: bigint;
      outcome: string;
      confidencePpm: number;
      freshnessWindowBlocks: number;
      validUntilSourceBlock: bigint;
      assessmentHash: string;
      caseHash: string;
      evidenceAnchorHash: string;
      sourceNetwork: string;
      sourceChainId: bigint;
      riskFlagsJson: string;
      summary: string;
      publishedAt: bigint;
    };

    result[subjectId] = {
      subject_id: record.subjectId,
      domain_id: record.domainId,
      case_id: record.caseId,
      claim_type: record.claimType,
      revision: Number(record.revision),
      outcome: record.outcome,
      confidence_ppm: Number(record.confidencePpm),
      freshness_window_blocks: Number(record.freshnessWindowBlocks),
      valid_until_source_block: Number(record.validUntilSourceBlock),
      assessment_hash: record.assessmentHash,
      case_hash: record.caseHash,
      evidence_anchor_hash: record.evidenceAnchorHash,
      source_network: record.sourceNetwork,
      source_chain_id: Number(record.sourceChainId),
      risk_flags: parseRiskFlags(record.riskFlagsJson),
      summary: record.summary,
      published_at: Number(record.publishedAt),
      domain_interpretation: interpretJudgmentDomain({
        domain_id: record.domainId,
        claim_type: record.claimType,
        case_id: record.caseId,
        outcome: record.outcome,
        risk_flags: parseRiskFlags(record.riskFlagsJson),
        summary: record.summary,
      }),
    };
  }

  return result;
}

function deriveState(judgment: MirrorJudgment | undefined, currentSourceBlock: number): CoordinatedState {
  if (!judgment || !judgment.subject_id) {
    return "NO_JUDGMENT";
  }
  if (judgment.valid_until_source_block > 0 && currentSourceBlock > judgment.valid_until_source_block) {
    return "STALE";
  }

  switch (judgment.outcome) {
    case "SAFE":
      return "SAFE";
    case "CAUTION":
      return "CAUTION";
    case "UNSAFE":
      return "UNSAFE";
    case "INSUFFICIENT_DATA":
      return "INSUFFICIENT_DATA";
    default:
      return "NO_JUDGMENT";
  }
}

function needsRefresh(value: CoordinatedState) {
  return value === "STALE" || value === "NO_JUDGMENT" || value === "INSUFFICIENT_DATA";
}

function parseRiskFlags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [String(parsed)];
  } catch {
    return value ? [value] : [];
  }
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
