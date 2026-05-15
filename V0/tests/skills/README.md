# Skill Tests

Run: `node --test tests/skills/*.test.mjs`

## What's covered

- `structure.test.mjs` — every required skill exists, frontmatter is valid, description ≤200 chars, uses imperative trigger pattern, fixtures cover all skills, no inter-skill imports (FR-2.1, FR-2.2, FR-2.4).

## What's NOT covered (yet)

- **Live trigger accuracy (FR-2.3 ≥90%).** Real measurement requires running the agent against `triggers.fixtures.json`. Today this is a manual review on a fresh session: paste each prompt and verify the right skill auto-invokes.

## Adding a fixture

Edit `triggers.fixtures.json`. Each case is `{ "prompt": "...", "expected_skill": "<name>" }`. The `expected_skill` must be one of the 7 in `REQUIRED_SKILLS`.
