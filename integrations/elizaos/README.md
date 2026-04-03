# ElizaOS Integration

This folder scaffolds an ElizaOS plugin that lets an Eliza agent consume RJP judgments before it decides whether to interact with a wallet or counterparty.

## What It Does

The integration uses the Base mirror as the fast consumption layer.

- `rjpJudgmentProvider` injects the latest mirrored judgment and handshake preview into Eliza context.
- `checkCounterpartyJudgmentAction` lets an agent explicitly inspect a wallet before replying or routing an action.
- `rjpClient` talks to the local RJP showcase API instead of reimplementing all of the Base mirror calls inside the plugin.

This matches the current product split:

- GenLayer produces the judgment.
- Base mirrors the judgment.
- Eliza consumes the mirrored state and decides how to behave.

## Recommended Test Path

1. Keep the local RJP API running:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xD3bB89CaFC0986a60C7e4927d9BbD0d53692848C \
npm run showcase:api
```

2. In your Eliza project, copy `src/` into a plugin package or local plugin folder.

3. Set the plugin env vars:

```bash
RJP_API_URL=http://127.0.0.1:4174
RJP_DEFAULT_ACTION_TYPE=trade
RJP_DEFAULT_SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001
```

Optional:

```bash
RJP_BASE_MIRROR_ADDRESS=0x34EBfd4FcC379b14Cdd602485417a5C088228606
RJP_BASE_AGENT_DEMO_ADDRESS=0x60381D4088B7B2C985B248CE8B64287c13b71434
```

4. Register the plugin in Eliza and ask the agent questions like:

- `Should I trade with 0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c?`
- `Check counterparty risk for 0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`
- `Can I route an action to 0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c right now?`

## Local Multi-Agent Testbed

There is also a local headless Eliza testbed in:

- `testbed/package.json`
- `testbed/src/agents.ts`
- `testbed/src/test_judgments.ts`

Install and run:

```bash
cd /home/jay/codex/genlayer/rjp/integrations/elizaos/testbed
npm install
RJP_API_URL=http://127.0.0.1:4174 \
RJP_DEFAULT_ACTION_TYPE=trade \
RJP_DEFAULT_SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001 \
npm run test:judgments
```

What it does:

- initializes two Eliza agents locally
- queries the live Base mirror and handshake preview through the RJP API
- checks one `SAFE` wallet and one `UNSAFE` wallet
- prints how the agents would react

This is the fastest way to prove that Eliza agents can consume the current RJP trust layer before you wire a full chat UI or external model provider.

## Real Runtime Project

There is also a runtime-ready multi-agent Eliza project at:

- `project/package.json`
- `project/src/index.ts`
- `project/src/characters/judgmentScout.ts`
- `project/src/characters/executionRouter.ts`

This is the path intended for a real `elizaos start` session with OpenRouter as the model provider.

Expected env:

```bash
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_SMALL_MODEL=google/gemini-2.0-flash-001
OPENROUTER_LARGE_MODEL=google/gemini-2.5-flash-preview-05-20
RJP_API_URL=http://127.0.0.1:4174
RJP_DEFAULT_ACTION_TYPE=trade
RJP_DEFAULT_SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001
```

Recommended order:

1. build the local RJP plugin:

```bash
cd /home/jay/codex/genlayer/rjp/integrations/elizaos
npm install
npm run build
```

2. install the Eliza project runtime deps:

```bash
cd /home/jay/codex/genlayer/rjp/integrations/elizaos/project
npm install
```

3. start the runtime:

```bash
npm run start
```

Current status in this repo:

- the local plugin builds
- the headless multi-agent testbed runs successfully
- the full chat/runtime project is scaffolded and ready
- but the full runtime dependency install was not fully verified here because npm timed out while resolving the heavier Eliza runtime graph

## API Dependency

The plugin expects the local RJP API to expose:

- `GET /mirror-judgment?subject=0x...`
- `GET /handshake-preview?subject=0x...&action_type=trade`

Those routes are implemented in [showcase_api.py](/home/jay/codex/genlayer/rjp/scripts/showcase_api.py).

## Testing Goal

The first goal is not hard enforcement inside Eliza. The first goal is to prove:

- the agent reads mirrored judgments correctly
- the agent changes its response based on `SAFE`, `UNSAFE`, `STALE`, or missing state
- the same agent behaves differently for different counterparties

Once that works, you can optionally add:

- automatic refusal for `UNSAFE`
- human-review escalation for `CAUTION`
- refresh request for `STALE`

## File Map

- `src/services/rjpClient.ts`
- `src/providers/rjpJudgmentProvider.ts`
- `src/actions/checkCounterpartyJudgment.ts`
- `src/plugin.ts`
- `examples/eliza-character-snippet.md`
