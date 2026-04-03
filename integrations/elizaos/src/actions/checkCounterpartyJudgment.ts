import { RjpClient } from "../services/rjpClient.js";

type ActionRuntime = {
  getSetting?: (key: string) => string | undefined;
};

type ActionResult = {
  text: string;
  values?: Record<string, unknown>;
};

type Action = {
  name: string;
  description: string;
  similes: string[];
  validate: (runtime: ActionRuntime, message: { content?: { text?: string } }) => Promise<boolean>;
  handler: (
    runtime: ActionRuntime,
    message: { content?: { text?: string } },
    state?: Record<string, unknown>,
  ) => Promise<ActionResult>;
};

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/g;

function extractSubjectId(
  runtime: ActionRuntime,
  message: { content?: { text?: string } },
  state?: Record<string, unknown>,
): string | undefined {
  const fromState = state?.counterpartyAddress || state?.subjectId;
  if (typeof fromState === "string" && fromState.trim()) {
    return fromState.trim();
  }
  const matches = message.content?.text?.match(ADDRESS_RE);
  if (matches?.[0]) {
    return matches[0];
  }
  return (
    runtime.getSetting?.("RJP_DEFAULT_SUBJECT_ID") ||
    process.env.RJP_DEFAULT_SUBJECT_ID ||
    undefined
  );
}

async function handleJudgmentCheck(
  runtime: ActionRuntime,
  message: { content?: { text?: string } },
  state?: Record<string, unknown>,
): Promise<ActionResult> {
  const subjectId = extractSubjectId(runtime, message, state);
  if (!subjectId) {
    return {
      text: "I need a wallet address to check its RJP judgment.",
    };
  }

  const client = new RjpClient(
    runtime.getSetting?.("RJP_API_URL") || process.env.RJP_API_URL,
    runtime.getSetting?.("RJP_DEFAULT_ACTION_TYPE") || process.env.RJP_DEFAULT_ACTION_TYPE,
  );
  const [mirror, handshake] = await Promise.all([
    client.getMirrorJudgment(subjectId),
    client.getHandshakePreview(subjectId),
  ]);

  return {
    text: [
      `RJP check for ${subjectId}:`,
      `State: ${handshake.state}`,
      `Outcome: ${mirror.outcome}`,
      `Allowed now: ${handshake.allowed}`,
      `Reason: ${handshake.reason}`,
      `Recommended action hint: ${handshake.recommended_action}`,
      `Summary: ${mirror.summary}`,
    ].join("\n"),
    values: {
      rjpSubjectId: subjectId,
      rjpOutcome: mirror.outcome,
      rjpState: handshake.state,
      rjpAllowed: handshake.allowed,
      rjpReasonCode: handshake.reason_code,
    },
  };
}

function makeJudgmentAction(name: string, similes: string[]): Action {
  return {
    name,
    description: "Checks the latest RJP mirrored judgment for a wallet before an interaction.",
    similes,
    async validate(runtime, message) {
      return Boolean(extractSubjectId(runtime, message));
    },
    handler: handleJudgmentCheck,
  };
}

export const checkCounterpartyJudgmentAction = makeJudgmentAction(
  "CHECK_COUNTERPARTY_JUDGMENT",
  ["CHECK_RISK", "CHECK_TRUST", "CHECK_JUDGMENT"],
);

export const checkWalletRjpJudgmentAction = makeJudgmentAction(
  "CHECK_WALLET_RJP_JUDGMENT",
  ["CHECK_RJP_JUDGMENT", "CHECK_MIRRORED_RJP"],
);
