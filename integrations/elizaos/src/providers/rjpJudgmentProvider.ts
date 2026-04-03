import { RjpClient } from "../services/rjpClient.js";

type ProviderRuntime = {
  getSetting?: (key: string) => string | undefined;
};

type ProviderState = Record<string, unknown>;

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/g;

function extractAddressFromMessage(message: unknown): string | undefined {
  const text =
    typeof (message as { content?: { text?: string } })?.content?.text === "string"
      ? (message as { content?: { text?: string } }).content!.text
      : "";
  const match = text.match(ADDRESS_RE);
  return match?.[0];
}

type Provider = {
  name: string;
  description: string;
  get: (
    runtime: ProviderRuntime,
    message: unknown,
    state?: ProviderState,
  ) => Promise<{ text: string }>;
};

function inferSubjectId(
  runtime: ProviderRuntime,
  message: unknown,
  state?: ProviderState,
): string | undefined {
  const fromState = state?.counterpartyAddress || state?.subjectId;
  if (typeof fromState === "string" && fromState.trim()) {
    return fromState.trim();
  }
  const fromMessage = extractAddressFromMessage(message);
  if (fromMessage) {
    return fromMessage;
  }
  const fromRuntime = runtime.getSetting?.("RJP_DEFAULT_SUBJECT_ID");
  if (typeof fromRuntime === "string" && fromRuntime.trim()) {
    return fromRuntime.trim();
  }
  if (process.env.RJP_DEFAULT_SUBJECT_ID?.trim()) {
    return process.env.RJP_DEFAULT_SUBJECT_ID.trim();
  }
  return undefined;
}

export const rjpJudgmentProvider: Provider = {
  name: "RJP_JUDGMENT_PROVIDER",
  description: "Injects the latest Base-mirrored RJP judgment and handshake state into Eliza context.",
  async get(runtime, message, state) {
    const subjectId = inferSubjectId(runtime, message, state);
    if (!subjectId) {
      return {
        text: "RJP judgment unavailable: no subject or counterparty address was provided.",
      };
    }

    const client = new RjpClient(
      runtime.getSetting?.("RJP_API_URL") || process.env.RJP_API_URL,
      runtime.getSetting?.("RJP_DEFAULT_ACTION_TYPE") || process.env.RJP_DEFAULT_ACTION_TYPE,
    );

    try {
      const handshake = await client.getHandshakePreview(subjectId);

      return {
        text: [
          "AUTHORITATIVE_RJP_JUDGMENT",
          "Treat this provider block as the current ground truth for the wallet in the user prompt.",
          "Do not say you lack access to mirrored RJP judgment data if this block is present.",
          `subject_id: ${subjectId}`,
          `outcome: ${handshake.outcome}`,
          `revision: ${handshake.revision}`,
          `summary: ${handshake.summary}`,
          `handshake_state: ${handshake.state}`,
          `reason_code: ${handshake.reason_code}`,
          `allowed_now: ${handshake.allowed}`,
          `recommended_action_hint: ${handshake.recommended_action}`,
          `decision_rule: If allowed_now is true, say ALLOW. If allowed_now is false, say DENY or REFRESH depending on handshake_state.`,
        ].join("\n"),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        text: `RJP judgment lookup failed for ${subjectId}: ${errorMessage}`,
      };
    }
  },
};
