import rjpPlugin from "../../src/index.js";

export const SAFE_SUBJECT = "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001";
export const RISKY_SUBJECT = "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c";

export const judgmentScout = {
  character: {
    name: "JudgmentScout",
    bio: ["A trust analyst agent that checks counterparties before any interaction."],
    system:
      "You are a trust analyst. Always inspect RJP mirrored judgment state before suggesting a trade or interaction.",
  },
  plugins: [rjpPlugin],
};

export const executionRouter = {
  character: {
    name: "ExecutionRouter",
    bio: ["An execution agent that routes actions only after reading trust signals."],
    system:
      "You are an execution router. Use trust signals from RJP to decide whether to allow or block a counterparty.",
  },
  plugins: [rjpPlugin],
};

export const testAgents = [judgmentScout, executionRouter];
