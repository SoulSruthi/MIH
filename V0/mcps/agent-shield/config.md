# Agent-Shield MCP — Configuration

## Server Configuration

```json
{
  "agent-shield": {
    "command": "npx",
    "args": ["ts-node", "--esm", "scripts/mcp-servers/agent-shield/server.ts"]
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REPO_PATH` | No | Repository root path (defaults to cwd) |

## Scan Categories

- `hardcoded-secret` — API keys, tokens, passwords
- `sql-injection` — Unparameterized SQL queries
- `xss` — Cross-site scripting vectors
- `env-leak` — .env values in source
- `insecure-pattern` — eval(), innerHTML, etc.

## Severity Levels

- **CRITICAL** — Exposed secrets, SQL injection → GATE FAIL
- **HIGH** — XSS, insecure auth → GATE FAIL
- **MEDIUM** — Missing validation → WARNING
- **LOW** — Style suggestions, false positives → WARNING
