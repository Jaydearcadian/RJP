# Eliza Character Snippet

Use this as the minimal plugin wiring pattern inside an Eliza character or runtime setup.

```ts
import rjpPlugin from "./plugins/rjp/plugin";

export default {
  name: "Trust-Aware Operator",
  plugins: [rjpPlugin],
  settings: {
    RJP_API_URL: "http://127.0.0.1:4174",
    RJP_DEFAULT_ACTION_TYPE: "trade",
    RJP_DEFAULT_SUBJECT_ID: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
  },
};
```

Example prompts:

- `Check counterparty risk for 0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`
- `Should I trade with 0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001?`
- `Look up the current judgment for 0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`
