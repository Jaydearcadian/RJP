import { performance } from "node:perf_hooks";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ElizaOS } from "@elizaos/core";
import openrouterPlugin from "@elizaos/plugin-openrouter";
import sqlPlugin, { createDatabaseAdapter } from "@elizaos/plugin-sql";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import rjpPlugin from "../../src/index.js";
import { RISKY_SUBJECT, SAFE_SUBJECT } from "./agents.js";

const replyCompatibilityPlugin = {
  name: "rjp-testbed-reply-compat",
  description: "Minimal compatibility actions for the stripped-down Eliza runtime harness.",
  actions: [
    {
      name: "REPLY",
      description: "Completes a reply action in the lightweight terminal harness.",
      similes: ["RESPOND"],
      validate: async () => true,
      handler: async () => ({ ok: true }),
    },
    {
      name: "CALL_MCP_TOOL",
      description: "No-op MCP tool compatibility action for the lightweight terminal harness.",
      similes: ["USE_TOOL"],
      validate: async () => true,
      handler: async () => ({ ok: true }),
    },
  ],
};

const demoAbi = [
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

const agentSpecs = [
  {
    id: "7a8801f7-06cf-070a-8baf-a86c8f65f3e7",
    name: "JudgmentScout",
    bio: ["A trust analyst agent that checks mirrored RJP judgments first."],
    system:
      "You are a trust analyst. The provider named RJP_JUDGMENT_PROVIDER is authoritative current wallet trust data. Use it before any answer.",
  },
  {
    id: "7bf0a857-cce0-0123-a31d-7af05b77dd50",
    name: "ExecutionRouter",
    bio: ["An execution router agent that blocks risky counterparties."],
    system:
      "You are an execution router. Use handshake_state, allowed_now, and recommended_action_hint directly.",
  },
  {
    id: "f877d0f7-dbf1-01f1-a034-7578f4dbc368",
    name: "CounterpartyGuard",
    bio: ["A counterparty screening agent for onchain execution."],
    system:
      "You are a counterparty guard. Read RJP_JUDGMENT_PROVIDER and only return ALLOW, DENY, or REFRESH with a short reason.",
  },
  {
    id: "27c40870-51f0-0367-aebb-f1f0486e0300",
    name: "RiskDesk",
    bio: ["A risk desk agent for settlement readiness."],
    system:
      "You are a risk desk. Treat the RJP provider block as the source of truth and summarize the decision tersely.",
  },
  {
    id: "fe48171e-3933-0df0-a0a7-ba20e8d60061",
    name: "SwarmRouter",
    bio: ["A routing agent coordinating multiple peers."],
    system:
      "You are a swarm router. Use the provider state exactly. Do not improvise beyond ALLOW, DENY, or REFRESH.",
  },
  {
    id: "e6dcd2d5-5ca2-09e8-b001-097e56b97e95",
    name: "PolicySentinel",
    bio: ["A policy sentinel that enforces mirrored trust state."],
    system:
      "You are a policy sentinel. The RJP provider is authoritative. Use it to decide whether a wallet can trade now.",
  },
];

type ProcessingLike = {
  text?: string;
  responseContent?: { text?: string } | null;
  state?: { text?: string } | Record<string, unknown>;
};

function randomId(): string {
  return crypto.randomUUID();
}

function deriveDecisionFromState(processing: ProcessingLike | undefined) {
  const stateText =
    typeof processing?.state?.text === "string"
      ? processing.state.text
      : JSON.stringify(processing?.state ?? {});

  const allowedMatch = stateText.match(/allowed_now:\s*(true|false)/i);
  const handshakeMatch = stateText.match(/handshake_state:\s*([A-Z_]+)/i);
  const outcomeMatch = stateText.match(/outcome:\s*([A-Z_]+)/i);
  const reasonCodeMatch = stateText.match(/reason_code:\s*([A-Z_]+)/i);
  const summaryMatch = stateText.match(/summary:\s*(.+)/i);

  if (!allowedMatch || !handshakeMatch || !outcomeMatch) {
    return null;
  }

  const allowed = allowedMatch[1].toLowerCase() === "true";
  const handshakeState = handshakeMatch[1];
  const outcome = outcomeMatch[1];
  const reasonCode = reasonCodeMatch?.[1] || "UNKNOWN";
  const summary = summaryMatch?.[1]?.trim() || "";
  const decision = allowed ? "ALLOW" : handshakeState === "STALE" ? "REFRESH" : "DENY";

  return {
    decision,
    allowed,
    handshake_state: handshakeState,
    outcome,
    reason_code: reasonCode,
    summary,
  };
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }
  if (!process.env.BASE_PRIVATE_KEY?.trim()) {
    throw new Error("Missing BASE_PRIVATE_KEY");
  }
  const demoAddress = process.env.BASE_AGENT_DEMO_ADDRESS?.trim();
  if (!demoAddress) {
    throw new Error("Missing BASE_AGENT_DEMO_ADDRESS");
  }

  const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
  const actionType = process.env.RJP_DEFAULT_ACTION_TYPE || "trade";
  const subjects = [SAFE_SUBJECT, RISKY_SUBJECT];
  const prompt =
    "Check the RJP judgment for this wallet and decide whether I should trade with it. Answer ALLOW, DENY, or REFRESH for wallet";

  const account = privateKeyToAccount(normalizePrivateKey(process.env.BASE_PRIVATE_KEY));
  const basePublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseRpcUrl),
  });
  const baseWalletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(baseRpcUrl),
  });

  const initialNonce = await basePublicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  let nextNonce = initialNonce;

  const eliza = new ElizaOS();
  const plugins = [sqlPlugin, openrouterPlugin, rjpPlugin, replyCompatibilityPlugin];
  const pgliteDir = await mkdtemp(path.join(os.tmpdir(), "rjp-eliza-benchmark-"));

  const agentDefinitions = [] as any[];
  for (let index = 0; index < agentSpecs.length; index += 1) {
    const spec = agentSpecs[index];
    const agentDir = `${pgliteDir}/agent-${index + 1}`;
    const db = createDatabaseAdapter(
      { dataDir: agentDir },
      spec.id,
    ) as any;
    await db.init();
    await db.runPluginMigrations(plugins, { verbose: false });

    agentDefinitions.push({
      character: {
        id: spec.id,
        name: spec.name,
        bio: spec.bio,
        system: spec.system,
      },
      settings: {
        PROVIDERS_TOTAL_TIMEOUT_MS: "15000",
      },
      plugins: [openrouterPlugin, rjpPlugin, replyCompatibilityPlugin],
      databaseAdapter: db,
    });
  }

  const agentIds: string[] = [];
  for (const agentDefinition of agentDefinitions) {
    const [agentId] = await eliza.addAgents([agentDefinition] as any);
    await eliza.startAgents([agentId] as any);
    agentIds.push(agentId);
  }

  const results: Array<Record<string, unknown>> = [];

  for (let agentIndex = 0; agentIndex < agentIds.length; agentIndex += 1) {
    const agentId = agentIds[agentIndex];
    const agentName = agentSpecs[agentIndex].name;

    for (const subject of subjects) {
      const receiveStartedAt = performance.now();
      const messageResult = await eliza.handleMessage(
        agentId,
        {
          entityId: randomId(),
          roomId: randomId(),
          content: {
            text: `${prompt} ${subject}`,
            source: "terminal",
          },
        },
        {
          useMultiStep: true,
          maxMultiStepIterations: 3,
        },
      );
      const receiveMs = Math.round(performance.now() - receiveStartedAt);

      const processing = (messageResult as any)?.processing as ProcessingLike | undefined;
      const decision = deriveDecisionFromState(processing);
      if (!decision) {
        results.push({
          agent_id: agentId,
          agent_name: agentName,
          subject_id: subject,
          receive_ms: receiveMs,
          error: "Failed to derive decision from provider state",
          processing: processing ?? null,
        });
        continue;
      }

      const preview = await basePublicClient.readContract({
        address: demoAddress as `0x${string}`,
        abi: demoAbi,
        functionName: "previewActionHandshake",
        args: [subject, actionType],
      });

      const settleStartedAt = performance.now();
      const txHash = await baseWalletClient.writeContract({
        address: demoAddress as `0x${string}`,
        abi: demoAbi,
        functionName: "attemptAction",
        args: [subject, actionType],
        chain: baseSepolia,
        account,
        nonce: nextNonce,
      });
      nextNonce += 1;
      const receipt = await basePublicClient.waitForTransactionReceipt({ hash: txHash });
      const settleMs = Math.round(performance.now() - settleStartedAt);

      results.push({
        agent_id: agentId,
        agent_name: agentName,
        subject_id: subject,
        receive_ms: receiveMs,
        interpret: decision,
        onchain_preview: {
          state: preview.state,
          recommended_action: preview.recommendedAction,
          reason_code: preview.reasonCode,
          allowed: preview.allowed,
          outcome: preview.outcome,
          revision: Number(preview.revision),
        },
        settle_ms: settleMs,
        tx_hash: txHash,
        block_number: Number(receipt.blockNumber),
      });
    }
  }

  if (typeof (eliza as any).stopAgents === "function") {
    await (eliza as any).stopAgents();
  }

  const safeRows = results.filter((row) => !("error" in row));
  console.log(
    JSON.stringify(
      {
        config: {
          agent_count: agentIds.length,
          subjects,
          action_type: actionType,
          base_agent_demo_address: demoAddress,
          actor: account.address,
        },
        summary: {
          total_runs: results.length,
          successful_runs: safeRows.length,
          receive_ms: summarizeNumbers(safeRows.map((row) => Number((row as any).receive_ms))),
          settle_ms: summarizeNumbers(safeRows.map((row) => Number((row as any).settle_ms))),
        },
        results,
      },
      null,
      2,
    ),
  );
}

function summarizeNumbers(values: number[]) {
  if (!values.length) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round(total / values.length),
    samples: values,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
