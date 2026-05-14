# Hook Tests

Run: `node --test tests/hooks/`

Each hook has a `*.test.mjs` file. Tests spawn the hook script as a subprocess, pipe a JSON fixture to stdin, and assert on exit code + stderr/stdout + audit log side-effects.

## Layout

- `helpers.mjs` — shared spawn/run helper.
- `pretooluse.test.mjs` — block + allow paths.
- `posttooluse.test.mjs` — audit jsonl append.
- `sessionstart.test.mjs` — context output ≤500 tokens.
- `stop.test.mjs` — pattern-extraction queue trigger.
- `subagentstop.test.mjs` — subagent payload logging.
- `fixtures/` — sample stdin JSON inputs.

## Adding a case

1. Add a fixture JSON in `fixtures/`.
2. Add a `test(...)` block calling `runHook(hookName, fixturePath)`.
3. Assert on `result.code`, `result.stderr`, or check log side-effects.
