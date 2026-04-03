import { ElizaOS } from "@elizaos/core";

import { RjpClient } from "../../src/services/rjpClient.js";
import { checkCounterpartyJudgmentAction } from "../../src/actions/checkCounterpartyJudgment.js";
import { rjpJudgmentProvider } from "../../src/providers/rjpJudgmentProvider.js";
import { RISKY_SUBJECT, SAFE_SUBJECT, testAgents } from "./agents.js";

type RuntimeLike = {
  getSetting?: (key: string) => string | undefined;
};

function runtimeSettings(): RuntimeLike {
  return {
    getSetting(key: string) {
      return process.env[key];
    },
  };
}

async function runProviderChecks(client: RjpClient): Promise<void> {
  for (const subject of [SAFE_SUBJECT, RISKY_SUBJECT]) {
    const mirror = await client.getMirrorJudgment(subject);
    const handshake = await client.getHandshakePreview(subject, "trade");
    console.log(
      JSON.stringify(
        {
          subject,
          outcome: mirror.outcome,
          state: handshake.state,
          allowed: handshake.allowed,
          recommended_action: handshake.recommended_action,
          summary: mirror.summary,
        },
        null,
        2,
      ),
    );
  }
}

async function runActionChecks(): Promise<void> {
  const runtime = runtimeSettings();
  for (const subject of [SAFE_SUBJECT, RISKY_SUBJECT]) {
    const result = await checkCounterpartyJudgmentAction.handler(
      runtime,
      {
        content: {
          text: `Check counterparty risk for ${subject}`,
        },
      },
      {
        counterpartyAddress: subject,
      },
    );
    console.log(result.text);
  }
}

async function runProviderTextChecks(): Promise<void> {
  const runtime = runtimeSettings();
  for (const subject of [SAFE_SUBJECT, RISKY_SUBJECT]) {
    const text = await rjpJudgmentProvider.get(runtime, {}, { counterpartyAddress: subject });
    console.log(text);
  }
}

async function main() {
  const eliza = new ElizaOS();
  const agentIds = await eliza.addAgents(testAgents as any);
  console.log(`Initialized ${agentIds.length} Eliza agents for RJP judgment testing.`);
  for (const id of agentIds) {
    console.log(`- ${id}`);
  }

  const client = new RjpClient(
    process.env.RJP_API_URL || "http://127.0.0.1:4174",
    process.env.RJP_DEFAULT_ACTION_TYPE || "trade",
  );

  console.log("\nMirror + handshake checks:");
  await runProviderChecks(client);

  console.log("\nProvider text checks:");
  await runProviderTextChecks();

  console.log("\nAction checks:");
  await runActionChecks();

  if (typeof (eliza as any).stopAgents === "function") {
    await (eliza as any).stopAgents();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
