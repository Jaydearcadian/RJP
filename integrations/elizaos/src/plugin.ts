import {
  checkCounterpartyJudgmentAction,
  checkWalletRjpJudgmentAction,
} from "./actions/checkCounterpartyJudgment.js";
import { rjpEvidenceProvider } from "./providers/rjpEvidenceProvider.js";
import { rjpJudgmentProvider } from "./providers/rjpJudgmentProvider.js";

type Plugin = {
  name: string;
  description: string;
  providers: unknown[];
  actions: unknown[];
};

export const rjpPlugin: Plugin = {
  name: "rjp-plugin",
  description: "ElizaOS plugin for consuming Base-mirrored RJP judgments and handshake previews.",
  providers: [rjpJudgmentProvider],
  actions: [checkCounterpartyJudgmentAction, checkWalletRjpJudgmentAction],
};

export const rjpEvidencePlugin: Plugin = {
  name: "rjp-evidence-plugin",
  description: "ElizaOS plugin for consuming built RJP evidence summaries.",
  providers: [rjpEvidenceProvider],
  actions: [],
};

export default rjpPlugin;
