# Vibe Coding OS V5 — Native + Minimal

**A Claude-native dev OS for shipping production SaaS via prose intent.**

This repo IS the OS. It's not an app. Use it to scaffold new internal Builtrix products that ship features with one prose prompt + one Plan Mode approval.

V5 ships scoped or doesn't ship. See `VIBE_OS_V5_SPEC.md` for the canonical spec (D-01 through D-11).

---

## What you get

| Layer | Mechanism | What it does |
|---|---|---|
| **Constitution** | `CLAUDE.md` (174 lines) | Operating model + 5+1 gate pipeline |
| **Knowledge** | `.claude/skills/` (6 skills) | RLS, shadcn install, Vitest, secrets, directives, migrations |
| **Guardrails** | `.claude/hooks/` (5 hooks) | Deterministic blocks: writes to `policy/`, `baseline/`, `.git/`, `.env*`; dangerous bash; secret patterns |
| **Delegation** | `.claude/agents/` (3 subagents) | feature-builder (bash dispatcher), security-scanner, pattern-extractor |
| **Orchestration** | `scripts/v5/*.sh` (10 bash scripts) | Bash-first per D-03: directive-gen, plan-gen, tdd-task, verify, deploy, supabase, vercel, install-shadcn, auto-revert, check-prereqs |
| **MCPs** | `scripts/mcp/` (3 thin servers) | vibe-supabase (preview branches), vibe-vercel (async deploy detect), vibe-secret-scanner (regex-heavy scan). Plus the `supabase-cloud` HTTP relay. |
| **Distribution** | `plugin/bin/init.mjs` | Single scaffolder, no flags |
| **Watchdog** | `.github/workflows/post-merge-watchdog.yml` | Gate 6: auto-revert on 2 consecutive CI reds or Vercel main fail |
| **Governance** | `policy/`, `baseline/`, `runbooks/` | 7 policies, 5 baselines, 6 runbooks |

---

## Use the framework to scaffold a new app

```bash
node /path/to/VIBE_CODE_OS/plugin/bin/init.mjs /path/to/my-new-app

cd /path/to/my-new-app
npm install
npm run prepare
git init && git add -A && git commit -m "chore: scaffold from Vibe Coding OS V5"
git remote add origin git@github.com:<org>/<app>.git && git push -u origin main

# One-time: link external services
vercel link
supabase link --project-ref <ref>

# Verify CLI prereqs (gh, jq, supabase, vercel) are installed + authed
bash scripts/v5/check-prereqs.sh --strict
```

Then in Claude Code:

```
Build feature: <description>
```

V5 runs Gate 1 (directive) → Gate 2 (Plan Mode review, your one human checkpoint) → Gate 3 (TDD execution) → Gate 4 (verify + scan) → Gate 5 (push + preview URL) → Gate 6 (watchdog arms).

---

## Maintaining the framework itself

```bash
npm run test:v4         # full V5 framework suite (55 tests; rename pending)
npm run test:hooks      # 17 — hook block/allow/audit
npm run test:skills     # 7  — skill structural conformance
npm run test:agents     # 9  — subagent return contracts (3 V5 agents)
npm run test:plugin     # 6  — init + smoke
npm run test:mcp        # 11 — V5 MCP stdio handshakes + missing-auth degradation
```

55/55 tests should pass. Phase E adds operator-driven validation against live Supabase + Vercel + GitHub — see [validation/phase-e-runbook.md](validation/phase-e-runbook.md).

---

## How features get built (5+1 gate pipeline)

```
You:  "Build feature: monthly budget tracking"

  Gate 1  → directive-from-prompt skill writes directives/<ISO-stamp>-<slug>.md
  Gate 2  → scripts/v5/plan-gen.sh writes orchestration/<id>/{spec,plan,tasks}.md
            ▶ Plan Mode engages — you approve / edit / reject (one human checkpoint)
  Gate 3  → For each task: vitest-from-spec (RED) → minimal impl (GREEN) → REFACTOR
            scripts/v5/install-shadcn.sh + supabase.sh as needed
  Gate 4  → scripts/v5/verify.sh — build + test + coverage (≥80/90) + smoke +
            regression + secret scan (CRITICAL halts, others auto-fixed in parallel)
  Gate 5  → scripts/v5/deploy.sh — branch + push + Vercel preview URL → arms Gate 6

You:    Click preview → review → merge to main

  Gate 6  → post-merge-watchdog GitHub Action: CI on main + Vercel deploy state.
            2 consecutive reds OR Vercel main fail → scripts/v5/auto-revert.sh
            triggers (revert merge, recreate feature branch, open issue).
```

D-03: bash where possible, MCPs only where bash genuinely can't (auth flows, async polling, regex-heavy scanning).

---

## Layout

```
VIBE_CODE_OS/
├── CLAUDE.md                       OS constitution (174 lines)
├── VIBE_OS_V5_SPEC.md              canonical spec (D-01 through D-11)
├── CHANGELOG.md                    V4 → V5 transition record
├── .claude/
│   ├── hooks/                      5 hooks (deterministic guardrails)
│   ├── skills/                     6 on-demand knowledge skills
│   ├── agents/                     3 subagents
│   └── settings.json               hook wiring
├── .github/workflows/
│   └── post-merge-watchdog.yml     Gate 6 — CI + auto-revert
├── policy/                         7 governance rules (read-only, hook-enforced)
├── baseline/                       5 reference contracts (read-only, hook-enforced)
├── directives/                     feature intent records (per feature)
├── memory/
│   ├── logs/                       audit trail (gates, execution, security, regressions)
│   └── learned/<product>/          per-product pattern library (D-09)
├── orchestration/, specs/          AI-generated planning artifacts
├── execution/                      feature implementations
├── runbooks/                       recovery procedures (Gate 3/4/6, hook FP, plan reject, cutover)
├── scripts/
│   ├── v5/                         10 bash orchestration scripts + PREREQS.md
│   ├── mcp/                        3 thin MCP servers (supabase, vercel, secret-scanner)
│   └── secret-scanner.ts           pre-commit secret guard (CLI form)
├── plugin/                         init.mjs scaffolder + lib + templates
├── validation/                     Phase E runbook + checklist (operator-driven)
└── tests/                          framework tests
```

---

## Tech stack (D-05 — non-negotiable)

- **Next.js 16** + React 19 + TypeScript (strict)
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Postgres + Auth + RLS)
- **Vercel** (preview deploys + post-merge watchdog)
- **Vitest** (unit) + **Playwright** (e2e: `@smoke`, `@regression`, `@stretch`)
- **Husky** (pre-commit secret scan)

Overriding the stack requires updating skills + baselines.

---

## Status

| Phase | What | Status |
|---|---|---|
| A — Cuts | Delete 9 MCPs, 4 agents, 1 skill, .specify/, dead policies/baselines/slash commands | ✅ |
| B — Constitution + bash | New CLAUDE.md, scripts/v5/*.sh, feature-builder rewrite | ✅ |
| C — Integration MCPs | vibe-supabase (preview branches), vibe-vercel (async detect), vibe-secret-scanner | ✅ |
| D — Watchdog (Gate 6) | GitHub Action + auto-revert.sh + 2 runbooks | ✅ |
| E — CRM dry run | V0 offline ✅; V1–V5 require live services + CLIs (operator-driven) | ⏳ |
| F — Cutover | v4-final tag + 5.0.0-rc.0 | ✅ (RC; promotes to 5.0.0 after Phase E V1–V5 pass) |

Spec authority: `VIBE_OS_V5_SPEC.md`. Spec amendments via PR per §15.

---

## Prerequisites

- Node.js ≥18
- Git
- Claude Code CLI
- For scaffolded apps running real builds: `gh`, `jq`, `supabase`, `vercel` CLIs (see `scripts/v5/PREREQS.md`)

---

## License

UNLICENSED — internal Builtrix Labs use only (D-01).
