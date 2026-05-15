# Learning Engine MCP — Configuration

## Server Configuration

```json
{
  "learning-engine": {
    "command": "npx",
    "args": ["ts-node", "--esm", "scripts/mcp-servers/learning-engine/server.ts"]
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REPO_PATH` | No | Repository root path (defaults to cwd) |

## Pattern Categories

- `error-resolution` — Build/test errors and their fixes
- `debugging` — Common debugging steps
- `component-preference` — UI component choices
- `architecture` — Data model and API patterns
- `performance` — Optimization patterns

## Confidence Levels

| Level | Meaning | Behavior |
|-------|---------|----------|
| 1 | First occurrence | Stored, not applied |
| 2 | Confirmed once | Suggestion only |
| 3 | Used 3+ times | Auto-applied |
| 4 | Proven pattern | High priority |
| 5 | Established | Always applied |

## Storage

Patterns stored in `/memory/learned/patterns.md` (append-only, markdown format).
