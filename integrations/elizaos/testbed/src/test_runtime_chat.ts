import { ElizaOS } from "@elizaos/core";
import openrouterPlugin from "@elizaos/plugin-openrouter";
import sqlPlugin, { createDatabaseAdapter } from "@elizaos/plugin-sql";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

function randomId(): string {
  return crypto.randomUUID();
}

function deriveDecisionFromState(processing: any): string | null {
  const stateText =
    typeof processing?.state?.text === "string"
      ? processing.state.text
      : JSON.stringify(processing?.state ?? {});

  if (!stateText) {
    return null;
  }

  const allowedMatch = stateText.match(/allowed_now:\s*(true|false)/i);
  const handshakeMatch = stateText.match(/handshake_state:\s*([A-Z_]+)/i);
  const outcomeMatch = stateText.match(/outcome:\s*([A-Z_]+)/i);
  const reasonCodeMatch = stateText.match(/reason_code:\s*([A-Z_]+)/i);
  const summaryMatch = stateText.match(/summary:\s*(.+)/i);

  if (!allowedMatch && !handshakeMatch && !outcomeMatch) {
    return null;
  }

  const allowed = allowedMatch?.[1]?.toLowerCase() === "true";
  const handshakeState = handshakeMatch?.[1] || "UNKNOWN";
  const outcome = outcomeMatch?.[1] || "UNKNOWN";
  const reasonCode = reasonCodeMatch?.[1] || "UNKNOWN";
  const summary = summaryMatch?.[1]?.trim();

  const decision = allowed
    ? "ALLOW"
    : handshakeState === "STALE"
      ? "REFRESH"
      : "DENY";

  return [
    `${decision}: ${outcome} (${handshakeState})`,
    `reason_code=${reasonCode}`,
    summary ? `summary=${summary}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function chatForSubject(
  eliza: ElizaOS,
  agentId: string,
  subject: string,
  prompt: string,
) {
  const result = await eliza.handleMessage(agentId, {
    entityId: randomId(),
    roomId: randomId(),
    content: {
      text: `${prompt} ${subject}`,
      source: "terminal",
    },
  }, {
    useMultiStep: true,
    maxMultiStepIterations: 3,
  });

  const processing = (result as any)?.processing;
  const modelText =
    processing?.text ||
    processing?.responseContent?.text ||
    (result as any)?.text;
  const fallbackText = deriveDecisionFromState(processing);
  const text =
    fallbackText ||
    modelText ||
    JSON.stringify(result, null, 2);

  console.log(`\nAgent ${agentId} on ${subject}`);
  console.log(text);
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const eliza = new ElizaOS();
  const plugins = [sqlPlugin, openrouterPlugin, rjpPlugin, replyCompatibilityPlugin];
  const pgliteDir =
    process.env.PGLITE_DATA_DIR || await mkdtemp(path.join(os.tmpdir(), "rjp-eliza-runtime-"));

  const judgmentScoutDb = createDatabaseAdapter(
    { dataDir: `${pgliteDir}/judgment-scout` },
    "7a8801f7-06cf-070a-8baf-a86c8f65f3e7",
  ) as any;
  await judgmentScoutDb.init();
  await judgmentScoutDb.runPluginMigrations(plugins, { verbose: false });

  const executionRouterDb = createDatabaseAdapter(
    { dataDir: `${pgliteDir}/execution-router` },
    "7bf0a857-cce0-0123-a31d-7af05b77dd50",
  ) as any;
  await executionRouterDb.init();
  await executionRouterDb.runPluginMigrations(plugins, { verbose: false });

  const agentIds = await eliza.addAgents([
    {
      character: {
        name: "JudgmentScout",
        bio: ["A trust analyst agent that checks mirrored RJP judgments first."],
        system:
          "You are a trust analyst. The provider named RJP_JUDGMENT_PROVIDER is authoritative current wallet trust data. Never claim you lack access to mirrored RJP judgment data if that provider block is present. When outcome or allowed_now is present, use it directly and answer ALLOW, DENY, or REFRESH with a short reason.",
      },
      settings: {
        PROVIDERS_TOTAL_TIMEOUT_MS: "15000",
      },
      plugins: [
        openrouterPlugin,
        rjpPlugin,
        replyCompatibilityPlugin,
      ],
      databaseAdapter: judgmentScoutDb,
    },
    {
      character: {
        name: "ExecutionRouter",
        bio: ["An execution router agent that blocks risky counterparties."],
        system:
          "You are an execution router. The provider named RJP_JUDGMENT_PROVIDER is authoritative current wallet trust data. Never say you cannot access it if it is present. Use handshake_state, allowed_now, and recommended_action_hint directly and answer with a decision plus one sentence of rationale.",
      },
      settings: {
        PROVIDERS_TOTAL_TIMEOUT_MS: "15000",
      },
      plugins: [
        openrouterPlugin,
        rjpPlugin,
        replyCompatibilityPlugin,
      ],
      databaseAdapter: executionRouterDb,
    },
  ] as any);

  await eliza.startAgents();
  console.log(`Started ${agentIds.length} Eliza agents with OpenRouter.`);

  for (const agentId of agentIds) {
    await chatForSubject(
      eliza,
      agentId,
      SAFE_SUBJECT,
      "Check the RJP judgment for this wallet and decide whether I should trade with it. Answer ALLOW, DENY, or REFRESH for wallet",
    );
    await chatForSubject(
      eliza,
      agentId,
      RISKY_SUBJECT,
      "Check the RJP judgment for this wallet and decide whether I should trade with it. Answer ALLOW, DENY, or REFRESH for wallet",
    );
  }

  if (typeof (eliza as any).stopAgents === "function") {
    await (eliza as any).stopAgents();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
