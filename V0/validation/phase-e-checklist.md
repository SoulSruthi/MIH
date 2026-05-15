# Phase E — Validation checklist

Tracks the 6-step AI-CRM dry run from spec §9. Mirrors the runbook at [phase-e-runbook.md](./phase-e-runbook.md).

Update this file as you execute. Commit after each step transitions to ✓ or ✗ so the v5 branch carries the audit trail.

---

## Pre-flight

- [ ] CLIs installed: `bash scripts/v5/check-prereqs.sh --strict` exits 0
- [ ] `SUPABASE_ACCESS_TOKEN` exported
- [ ] `VERCEL_TOKEN` exported
- [ ] GitHub repo created (empty, private)
- [ ] Supabase project created (project ref noted)
- [ ] `gh auth status` shows logged in
- [ ] `vercel whoami` returns username

---

## Step status

| # | Step | Status | Date | Notes |
|---|---|---|---|---|
| V0 | Scaffold ai-crm | partial ⏳ | 2026-05-06 | offline parts ✓ (see autonomous validation below); operator finishes npm install + push + service linking |
| V1 | Build feature: lead-capture form with email/phone/validation | ☐ | — | preview URL must be functional |
| V2 | Build feature: list view of leads with filtering by status | ☐ | — | coverage ≥80% / ≥90% |
| V3 | Audit: codebase for vulnerabilities | ☐ | — | CRITICAL count = 0 after auto-fix |
| V4 | Merge V1 PR to main; watchdog confirms green | ☐ | — | no auto-revert, no issue opened |
| V5 | Induce regression on main; watchdog auto-reverts + opens issue | ☐ | — | requires 2 consecutive red CI runs |

---

## V0 autonomous validation (recorded 2026-05-06)

Ran in this Claude Code session against `v5` branch at commit `603a749`.

| Check | Result |
|---|---|
| `node plugin/bin/init.mjs <target> --verbose` exit code | 0 |
| All 16 V5 surface paths in scaffold | ✓ |
| Scaffolded `package.json` is V5 template | ✓ ("App scaffolded with Vibe Coding OS V5") |
| Scaffolded `CLAUDE.md` is V5 constitution | ✓ (174 lines, native+minimal text) |
| Scaffolded `.mcp.json` lists 4 V5 MCPs | ✓ (vibe-supabase, vibe-vercel, vibe-secret-scanner, supabase-cloud) |
| Scaffolded `secret-scanner` MCP boots | ✓ (initialize handshake + tools/list both succeed) |
| Scaffold path | `C:/Users/ragha/Desktop/ai-crm-validate` (throwaway; can be deleted) |

**Throwaway scaffold note:** `ai-crm-validate` was created during this session for V0 surface validation. It's outside the OS repo so it's not tracked. Delete with `rm -rf "C:/Users/ragha/Desktop/ai-crm-validate"` once you're done inspecting it. The real validation scaffold (`ai-crm`) is created in step V0.

---

## Per-step proof artifacts

When a step passes, record proof here:

### V0
- [ ] `git log` of `ai-crm` shows initial commit pushed
- [ ] `.vercel/project.json` exists with `projectId`
- [ ] `supabase/config.toml` has `project_id = "<ref>"` line
- [ ] `gh repo view` confirms remote exists

### V1
- [ ] Preview URL: ___________________________________
- [ ] Coverage report path: `coverage/coverage-summary.json` lines ≥ 80%, branches ≥ 90%
- [ ] Manual: form renders, validation works, Supabase row inserted

### V2
- [ ] Preview URL: ___________________________________
- [ ] Coverage still ≥ 80%/90%
- [ ] `memory/learned/<slug>/patterns.md` shows at least one V1-derived pattern referenced in V2's directive

### V3
- [ ] `memory/logs/security/<date>.jsonl` exists
- [ ] CRITICAL count: 0
- [ ] HIGH/MEDIUM count: ___ (auto-fixed, logged)

### V4
- [ ] PR URL: ___________________________________
- [ ] `gh run list --workflow post-merge-watchdog.yml --limit 1` last run conclusion: success
- [ ] No issue opened with `auto-revert` label after merge

### V5
- [ ] Triggered regression commit SHA: ___________________________________
- [ ] Watchdog auto-revert commit SHA: ___________________________________
- [ ] `memory/logs/regressions/<date>.jsonl` entry: ___________________________________
- [ ] GitHub issue URL: ___________________________________
- [ ] Recreated feature branch URL: ___________________________________

---

## Done criteria (spec §11 phase E + §12)

All 6 steps pass on first end-to-end run **AND** the success criteria from §12 hold:

- [ ] **§12.1** Single-prompt feature-ship rate ≥ 9/10 across the V1+V2 trial features ⟂ requires further trials beyond the §9 dry run
- [ ] **§12.2** Coverage discipline: V1 + V2 hit ≥80/90 without manual intervention
- [ ] **§12.3** Zero CRITICAL findings in V1 + V2 ship outputs
- [ ] **§12.4** Watchdog proves itself: V4 + V5 both pass
- [ ] **§12.5** Token economics: average per feature < 60% of V4 baseline ⟂ requires V4 baseline measured separately
- [ ] **§12.6** No CLI invocations in operator workflow during V1+V2 except the V0 scaffold

If §12.1 and §12.5 (which reference broader trials beyond the 6 §9 steps) cannot be measured in a single dry run, treat the §9 steps as the minimum bar and §12 as the production-readiness target. V5 stays at `5.0.0-rc.N` until §12 holds across at least 10 trial features.

---

## Sign-off

When all V0–V5 ✓ and the §12 done criteria are confirmed:

- [ ] Update this file: every step ✓, dates filled, proof artifacts populated
- [ ] Commit: `git commit -m "v5 phase E: validation passed — V0..V5 all green"`
- [ ] Proceed to **Phase F** — tag `v4-final` on the v4 branch, tag `v5.0.0` on this branch, push tags.
