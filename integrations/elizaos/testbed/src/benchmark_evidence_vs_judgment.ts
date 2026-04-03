import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  RjpClient,
  rjpEvidenceProvider,
  rjpJudgmentProvider,
} from "../../src/index.js";
import type {
  EvidenceSummary,
  HandshakePreview,
  MirrorJudgment,
} from "../../src/services/rjpClient.js";

type RuntimeLike = {
  getSetting?: (key: string) => string | undefined;
};

type BenchmarkCase = {
  id: string;
  subject: string;
  caseFile: string;
  actionType: "trade" | "approve";
  domainId: string;
  promptIntent: string;
};

type AgentConfig = {
  id: string;
  mode: "judgment" | "evidence";
  actionType: "trade" | "approve";
  system: string;
};

const CASES: BenchmarkCase[] = [
  {
    id: "counterparty-safe-trade",
    subject: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
    caseFile: path.resolve(
      process.cwd(),
      "../../..",
      "proof_bundles/proof-bundle-20260401-165310Z/cases/clean.case.json",
    ),
    actionType: "trade",
    domainId: "counterparty_trust.base_trade_v1",
    promptIntent: "Decide whether I should trade with this wallet.",
  },
  {
    id: "counterparty-risky-trade",
    subject: "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c",
    caseFile: path.resolve(
      process.cwd(),
      "../../..",
      "proof_bundles/proof-bundle-20260401-165310Z/cases/risky.case.json",
    ),
    actionType: "trade",
    domainId: "counterparty_trust.base_trade_v1",
    promptIntent: "Decide whether I should trade with this wallet.",
  },
  {
    id: "permission-sparse-approve",
    subject: "0x0000000000000000000000000000000000000b0b",
    caseFile: "/tmp/protocol_safety_unused_subject.case.json",
    actionType: "approve",
    domainId: "protocol_safety.base_erc20_permission_v1",
    promptIntent: "Decide whether I should approve a spender for this wallet.",
  },
];

const AGENTS: AgentConfig[] = [
  {
    id: "judgment-trade",
    mode: "judgment",
    actionType: "trade",
    system:
      "You are a judgment-driven agent. The RJP_JUDGMENT_PROVIDER block is authoritative. Use it directly and answer ALLOW, DENY, or REFRESH with one short reason.",
  },
  {
    id: "judgment-approve",
    mode: "judgment",
    actionType: "approve",
    system:
      "You are a judgment-driven approval agent. The RJP_JUDGMENT_PROVIDER block is authoritative. Use it directly and answer ALLOW, DENY, or REFRESH with one short reason.",
  },
  {
    id: "evidence-trade",
    mode: "evidence",
    actionType: "trade",
    system:
      "You are an evidence-driven agent. The RJP_EVIDENCE_PROVIDER block is authoritative evidence summary. Follow its binding_rule and evidence_decision_hint exactly unless the feature lines clearly contradict it. Answer ALLOW, DENY, or REFRESH with one short reason.",
  },
  {
    id: "evidence-approve",
    mode: "evidence",
    actionType: "approve",
    system:
      "You are an evidence-driven approval agent. The RJP_EVIDENCE_PROVIDER block is authoritative evidence summary. Follow its binding_rule and evidence_decision_hint exactly unless the feature lines clearly contradict it. Answer ALLOW, DENY, or REFRESH with one short reason.",
  },
];

function runtimeSettings(extra: Record<string, string>): RuntimeLike {
  return {
    getSetting(key: string) {
      return extra[key] ?? process.env[key];
    },
  };
}

function parseDecision(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = text.toUpperCase().match(/\b(ALLOW|DENY|REFRESH|REVIEW)\b/);
  return match?.[1] || null;
}

function deriveDecisionFromHandshake(handshake: HandshakePreview): string {
  if (handshake.allowed) {
    return "ALLOW";
  }
  if (handshake.state === "UNSAFE") {
    return "DENY";
  }
  return "REFRESH";
}

function deriveDecisionFromEvidence(summary: EvidenceSummary): string {
  const features = summary.feature_summary || {};
  const txCount = Number(features.tx_count || 0);
  const failedTxCount = Number(features.failed_tx_count || 0);
  const unboundedApprovals = Number(features.unbounded_approval_count || 0);
  const flaggedInteractions = Number(features.flagged_interaction_count || 0);

  if (txCount <= 0) {
    return "REFRESH";
  }
  if (unboundedApprovals > 0) {
    return "DENY";
  }
  if (failedTxCount > 0 || flaggedInteractions > 0) {
    return "REFRESH";
  }
  return "ALLOW";
}

function buildPrompt(testCase: BenchmarkCase): string {
  return [
    `${testCase.promptIntent} Answer only with ALLOW, DENY, or REFRESH plus a short reason for wallet ${testCase.subject}.`,
    `case_file=${testCase.caseFile}`,
    `domain_id=${testCase.domainId}`,
  ].join(" ");
}

async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; elapsed_ms: number }> {
  const started = performance.now();
  const result = await fn();
  return {
    result,
    elapsed_ms: Math.round((performance.now() - started) * 1000) / 1000,
  };
}

async function runHeadlessAgent(
  agent: AgentConfig,
  providerText: string,
  prompt: string,
  fallbackDecision: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 15000);

  const response = await measure(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: agent.system,
            },
            {
              role: "system",
              content: providerText,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!completion.ok) {
        const body = await completion.text();
        throw new Error(`OpenRouter ${completion.status}: ${body}`);
      }
      const payload = (await completion.json()) as any;
      return {
        text: String(payload?.choices?.[0]?.message?.content || ""),
        fallback_used: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        text: `${fallbackDecision} [provider-fallback: ${message}]`,
        fallback_used: true,
      };
    } finally {
      clearTimeout(timer);
    }
  });

  return {
    elapsed_ms: response.elapsed_ms,
    raw_text: response.result.text,
    parsed_decision: parseDecision(response.result.text),
    fallback_used: response.result.fallback_used,
  };
}

async function main() {
  const apiUrl = process.env.RJP_API_URL || "http://127.0.0.1:4174";
  const client = new RjpClient(apiUrl, "trade");
  const results = [];

  for (const testCase of CASES) {
    const prompt = buildPrompt(testCase);
    const evidenceRequest = {
      subject: testCase.subject,
      case_file: testCase.caseFile,
      domain_id: testCase.domainId,
    };

    const evidenceFetch = await measure(() => client.getEvidenceSummary(evidenceRequest));
    const mirrorFetch = await measure(() => client.getMirrorJudgment(testCase.subject));
    const handshakeFetch = await measure(() => client.getHandshakePreview(testCase.subject, testCase.actionType));

    const providerRuntime = runtimeSettings({
      RJP_API_URL: apiUrl,
      RJP_DEFAULT_ACTION_TYPE: testCase.actionType,
    });
    const providerMessage = { content: { text: prompt } };

    const evidenceProviderResult = await measure(() =>
      rjpEvidenceProvider.get(providerRuntime, providerMessage, {
        subjectId: testCase.subject,
      }),
    );
    const judgmentProviderResult = await measure(() =>
      rjpJudgmentProvider.get(providerRuntime, providerMessage, {
        subjectId: testCase.subject,
      }),
    );

    const evidenceAgentConfig = AGENTS.find(
      (agent) => agent.mode === "evidence" && agent.actionType === testCase.actionType,
    )!;
    const judgmentAgentConfig = AGENTS.find(
      (agent) => agent.mode === "judgment" && agent.actionType === testCase.actionType,
    )!;

    const evidenceAgentRun = await runHeadlessAgent(
      evidenceAgentConfig,
      evidenceProviderResult.result.text,
      prompt,
      deriveDecisionFromEvidence(evidenceFetch.result),
    );
    const judgmentAgentRun = await runHeadlessAgent(
      judgmentAgentConfig,
      judgmentProviderResult.result.text,
      prompt,
      deriveDecisionFromHandshake(handshakeFetch.result),
    );

    results.push({
      case: testCase,
      evidence_fetch: {
        elapsed_ms: evidenceFetch.elapsed_ms,
        summary: evidenceFetch.result,
      },
      judgment_fetch: {
        mirror_elapsed_ms: mirrorFetch.elapsed_ms,
        handshake_elapsed_ms: handshakeFetch.elapsed_ms,
        mirror: mirrorFetch.result as MirrorJudgment,
        handshake: handshakeFetch.result as HandshakePreview,
      },
      provider_injection: {
        evidence: {
          elapsed_ms: evidenceProviderResult.elapsed_ms,
          text: evidenceProviderResult.result.text,
        },
        judgment: {
          elapsed_ms: judgmentProviderResult.elapsed_ms,
          text: judgmentProviderResult.result.text,
        },
      },
      deterministic_baseline: {
        evidence_decision: deriveDecisionFromEvidence(evidenceFetch.result),
        judgment_decision: deriveDecisionFromHandshake(handshakeFetch.result),
      },
      headless_agents: {
        evidence_mode: evidenceAgentRun,
        judgment_mode: judgmentAgentRun,
      },
    });
  }

  const outDir = path.resolve(
    process.cwd(),
    "artifacts",
  );
  await mkdir(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `benchmark-evidence-vs-judgment-${timestamp}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    api_url: apiUrl,
    openrouter_model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    mode: "headless_eliza_provider_benchmark",
    cases: results,
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  console.log(
    JSON.stringify(
      {
        output_path: outPath,
        case_count: results.length,
        summary: results.map((entry) => ({
          case_id: entry.case.id,
          evidence_decision: entry.headless_agents.evidence_mode.parsed_decision,
          judgment_decision: entry.headless_agents.judgment_mode.parsed_decision,
          deterministic_evidence_decision: entry.deterministic_baseline.evidence_decision,
          deterministic_judgment_decision: entry.deterministic_baseline.judgment_decision,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
