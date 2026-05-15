# Changelog

## 5.0.0-rc.0 — 2026-05-06

First V5 release candidate. Spec authority: `VIBE_OS_V5_SPEC.md` (D-01 through D-11).

### Highlights

- **Operator surface reduced to one prose prompt + one Plan Mode review.** No CLI commands, no slash commands in feature workflow (D-02).
- **Bash-first orchestration** (D-03): `scripts/v5/*.sh` replaces ~70% of V4's MCP servers. Lower token cost, bypass-permissions-friendly, faster cold start.
- **5+1 gate pipeline.** Gates 1, 3, 4, 5 fully automated. Gate 2 surfaces in Plan Mode (the one human checkpoint, D-04). Gate 6 — post-merge watchdog — auto-reverts regressions on `main`.
- **Stack pinned** (D-05): Next.js 16 + TypeScript + Supabase + Vercel + Vitest + Playwright + shadcn.
- **Quality numbers of record** (D-06 / D-07): 80% lines / 90% branches; CRITICAL security findings hard-block with auto-fix loop (max 3); HIGH/MED/LOW logged + parallel-fixed.
- **Solo-dev safety net** (D-10): post-merge watchdog reverts on 2 consecutive CI reds OR Vercel main fail; recreates the feature branch from parent of revert; opens GitHub issue with `auto-revert,regression` labels.

### Surface change vs V4 (per kill list, §8)

Net: 104 files changed, +18,499 / −11,149 LOC across 15 commits on the v5 branch. Excluding the `package-lock.json` introduction (~15K lines), substantive change is roughly +3K / −11K — about 60% surface reduction on the operationally-relevant code.

#### Removed

- 10 MCP servers: speckit, playwright, structure-guardian, directive-resolver, execution-gate, intent-logger, message-bus, agent-shield, learning-engine, shadcn (V4's `scripts/mcp-servers/` dir gone)
- 4 subagents: spec-planner, test-runner, code-reviewer, directive-writer
- 1 skill: playwright-e2e-template
- `.specify/` (stale legal-domain constitution + broken PowerShell scripts)
- 6 policies: 005-mcp-interaction-authority, 006-controlled-execution, 007-autonomous-execution, 008-mcp-message-bus, 010-continuous-learning, 011-token-optimization
- 7 baselines: 002-auth-rbac, 003-mcp-contract, 004-autonomous-execution, 005-agent-shield, 006-learning-engine, 007-token-optimization, 010-plugin-contract
- Baseline metadata for the deleted Structure Guardian MCP: hashes.json, locked-files.md, structure.schema.json
- 14 slash commands: `/learn`, `/tdd`, `/security-scan`, `/token-report`, `/setup`, `/build`, all 9 `speckit.*`
- Plugin extras: `plugin/bin/cli.mjs`, `health.mjs`, `upgrade.mjs`, `plugin/migrations/0001-v3-to-v4.mjs`

#### Added

- `scripts/v5/` — 10 bash orchestration scripts + `PREREQS.md` + `_lib.sh` shared helpers + `check-prereqs.sh` self-check
- `scripts/mcp/` — 3 thin MCP servers (`secret-scanner`, `vercel`, `supabase`) replacing the empty/stub V4 versions; each has structured-error degradation on missing auth
- `.github/workflows/post-merge-watchdog.yml` — Gate 6 watchdog with `ci`, `watchdog`, `manual_revert` jobs
- `runbooks/gate-6-watchdog-failure.md` — recovery for false-positive reverts, missed regressions, watchdog crashes
- `runbooks/plan-mode-rejection.md` — recovery for the three Plan Mode reject paths
- `validation/phase-e-runbook.md` + `validation/phase-e-checklist.md` — operator-driven CRM dry run
- `tests/mcp/` — 11 stdio handshake + missing-auth tests for the new MCPs

#### Changed

- `CLAUDE.md` — fully rewritten, 248 → 174 lines (V5 native+minimal text, all references to deleted V4 components removed)
- `.claude/agents/feature-builder.md` — rewritten as bash dispatcher (calls `scripts/v5/build.sh`, `tdd-task.sh`, `verify.sh`, `deploy.sh`); owns only the conversational moments (Plan Mode, per-task TDD writes)
- `plugin/lib/copy.mjs` SOURCE_PATHS — adds `scripts/v5`, `scripts/mcp`, `.github/workflows/post-merge-watchdog.yml`, `VIBE_OS_V5_SPEC.md`; drops `scripts/mcp-servers` and `.claude/commands`
- `plugin/templates/README.md` — V5 onboarding text
- `plugin/plugin.json` — V5 manifest (6 skills, 3 agents, 4 MCPs, 1 bin entry, 7 policies, 5 baselines, 3 runbooks)
- `package.json` — `vibe-os` bin → `plugin/bin/init.mjs` (was deleted `cli.mjs`); 12 dead `start:*` scripts removed; `test:mcp` added; version → `5.0.0-rc.0`
- `.mcp.json` — V5 wiring with `vibe-supabase`, `vibe-vercel`, `vibe-secret-scanner` stdio entries; existing Supabase HTTP relay renamed to `supabase-cloud` to avoid collision
- `tests/plugin/smoke.test.mjs` — layers dict updated for V5 surface (init-only plugin, scripts/v5/build.sh, scripts/mcp/, watchdog workflow)

### Test status

55/55 framework tests pass (17 hooks + 7 skills + 9 agents + 6 plugin + 11 mcp + 5 plugin smoke). All commits on the v5 branch from `0d6a265` through `bacbab2` were green; no commit was committed with red tests.

### Outstanding for promotion to 5.0.0

Phase E V1–V5 (per spec §9) cannot run in a Claude Code session — they require live Supabase, Vercel, GitHub access plus the four CLI prereqs. V0 offline parts validated (scaffold creates all 16 V5 surface paths, `vibe-secret-scanner` MCP boots inside the scaffolded copy). V1–V5 are operator-driven from `validation/phase-e-runbook.md`. When the checklist in `validation/phase-e-checklist.md` is fully ✓, retag as `v5.0.0`.

### Carried-forward debt (intentionally deferred)

- **Policy/baseline numbering is non-contiguous** (policies: 001, 002, 003, 004, 009, 012, 013; baselines: 001, 008, 009, 011, 012). Renumbering would touch contract bodies and test fixtures; deferred to a contiguous-numbering pass post-Phase F.
- **Spec §7 vs §8 numeric mismatches** — §7's summary numbers (5 skills, 2 subagents, 6 policies) drifted from §8's detailed kill list (6, 3, 7). Resolved per the kill list. Spec amendment recommended via §15 process.
- **Phase E §12.1 + §12.5 metrics require ≥10 trial features** beyond the §9 dry run; treat §9 as the minimum bar for `v5.0.0` promotion.

---

## 4.0.0 — 2026-05-04

(Frozen at the `v4-final` tag.) Claude-native autonomous dev framework. Hooks for governance, skills for knowledge, subagents for delegation, plugin distribution. See V4 README on the `v4` branch.

## 3.0.0 — 2026-03-05

Security + Learning. agent-shield, pattern extraction, TDD enforcement, token optimization, pre-commit secret detection.

## 2.1.0 — 2026-03-05

Full autonomous — no permissions, inter-MCP messaging, AI-generated directives, branch deploys.

## 2.0.0 — 2026-01-31

Autonomous — auto gate progression.

## 1.0.0 — 2026-01-23

Foundation — manual gates.
