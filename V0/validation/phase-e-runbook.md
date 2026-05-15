# Phase E — AI-CRM dry-run validation runbook

**Spec authority:** `VIBE_OS_V5_SPEC.md` §9 + §11 phase E.
**Definition of done:** all 6 steps (V0–V5) pass on first attempt. If any step fails, V5 stays at `5.0.0-rc.N` until fixed.
**This runbook is operator-driven** — V1 through V5 require live Supabase, Vercel, GitHub, plus the four CLIs from `scripts/v5/PREREQS.md`. They cannot run in an autonomous Claude Code session.

---

## Prerequisites (one-time setup)

Before V0:

1. **Install CLIs** per `scripts/v5/PREREQS.md`:
   - `bash`, `git`, `node ≥18`, `npm ≥9` (already present)
   - `jq` — `choco install jq` on Windows / `brew install jq` on macOS / `apt-get install jq` on Linux
   - `gh` — https://cli.github.com/, then `gh auth login`
   - `supabase` — `scoop install supabase` (Win) / `brew install supabase/tap/supabase` (mac), then `supabase login`
   - `vercel` — `npm i -g vercel`, then `vercel login`

2. **Run the prereq self-check** — the smoke test for whether you're ready:
   ```bash
   cd VIBE_CODE_OS
   bash scripts/v5/check-prereqs.sh --strict
   ```
   Expect all CLIs ✓ and gh/vercel auth checks ✓. If any fail, follow the install hint and re-run before proceeding.

3. **Provision external services** (one-time per validation run):
   - **Supabase project:** Create at https://supabase.com/dashboard. Note the project ref (e.g., `zyxabc123`).
   - **GitHub repo:** Create an empty private repo named `vibe-os-validation-ai-crm` (or similar). Do not add README/license — V5 scaffolds those.
   - **Vercel project:** Will be linked during V0.

4. **Set environment variables** in your shell profile or a `.env.validation` file:
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_...      # from supabase.com/dashboard/account/tokens
   export VERCEL_TOKEN=...                    # from vercel.com/account/tokens
   ```

---

## V0 — Scaffold

**Spec pass criterion:** *"Repo scaffolds; framework tests pass; first commit pushed; Vercel project linked; Supabase ref set."*

### Steps

```bash
# From the VIBE_CODE_OS source repo:
cd "C:/Users/ragha/Desktop/Vibe Code OS/VIBE_CODE_OS"
node plugin/bin/init.mjs "C:/Users/ragha/Desktop/ai-crm" --verbose

cd "C:/Users/ragha/Desktop/ai-crm"
npm install
npm run prepare
git init
git add -A
git commit -m "chore: scaffold from Vibe Coding OS V5"
git remote add origin git@github.com:<your-org>/vibe-os-validation-ai-crm.git
git push -u origin main

# Link external services
vercel link                                    # creates .vercel/project.json
supabase link --project-ref <SUPABASE_REF>    # writes project_id into supabase/config.toml
```

### Expected outcome

- Scaffold output ends with `✓ init complete`
- All 16 V5 surface paths materialize (validated locally — see "V0 offline validation results" below)
- `npm install` completes (Next.js 16 + Supabase + Vitest + Playwright + shadcn deps)
- Initial commit pushed to `main`
- `.vercel/project.json` exists with `projectId` and `orgId`
- `supabase/config.toml` has `project_id = "<ref>"` line

### Pass/fail

- **Pass:** all 5 expected outcomes hold.
- **Fail mode 1: scaffold conflicts** — target dir not empty. Either pick a fresh dir or use `--force`.
- **Fail mode 2: vercel link fails** — auth/project missing. Run `vercel login` first; create the Vercel project in the dashboard if it doesn't exist.
- **Fail mode 3: supabase link fails** — auth missing. Run `supabase login` first.

### V0 offline validation results (autonomous part)

Recorded 2026-05-06 against the v5 branch at `603a749`:

- ✓ `node plugin/bin/init.mjs <target> --verbose` exits 0
- ✓ All 16 V5 surface paths present in scaffold (CLAUDE.md, V5 spec, all `scripts/v5/*.sh`, all 3 `scripts/mcp/*/server.mjs`, watchdog workflow, agents, skills, policies, baselines, runbooks, `memory/project-init.md`)
- ✓ Scaffolded `package.json` is the V5 template ("App scaffolded with Vibe Coding OS V5")
- ✓ Scaffolded `CLAUDE.md` is the V5 constitution (174 lines, V5 native+minimal text)
- ✓ Scaffolded `.mcp.json` lists all 4 V5 MCPs (vibe-supabase, vibe-vercel, vibe-secret-scanner, supabase-cloud)
- ✓ Scaffolded `secret-scanner` MCP boots cleanly: initialize handshake responds, `tools/list` returns both `scan_paths` and `scan_text` with full schemas
- ⏳ **Operator must complete:** `npm install`, `git push`, `vercel link`, `supabase link --project-ref`

---

## V1 — First feature: lead-capture form

**Prompt to issue (in Claude Code, inside the scaffolded repo):**

> Build feature: lead-capture form with email and phone fields, validation, save to Supabase

**Spec pass criterion:** *"Plan Mode shows directive + spec + plan; operator approves; pipeline runs end-to-end; preview URL works; lead form functional in preview."*

### What V5 should do (per CLAUDE.md + feature-builder agent)

| Gate | Action | Where to inspect |
|---|---|---|
| 1 | `directive-from-prompt` skill writes `directives/<ISO-stamp>-build-feature-lead-capture-form.md` | `directives/` dir, latest file |
| 2 | `scripts/v5/plan-gen.sh` writes `orchestration/<id>/{spec,plan,tasks}.md`. **Plan Mode engages** — review, then approve. | Plan Mode UI in Claude Code; same files on disk |
| 3 | TDD per task: `vitest-from-spec` writes failing test → minimal impl → refactor. Migration: `supabase.sh migrate-new` then operator confirms migration body, then `supabase.sh migrate-up`. shadcn: `install-shadcn.sh form input label` | `src/`, `tests/`, `supabase/migrations/` get populated |
| 4 | `verify.sh` — build + test + coverage (≥80/90) + smoke + regression + secret scan | `coverage/coverage-summary.json`; `memory/logs/security/<date>.jsonl` |
| 5 | `deploy.sh` — feature branch + commit + push + `vercel.sh wait-preview` (or `vibe-vercel/wait_for_preview` MCP if 60s exceeded) | `git log feature/<slug>`; preview URL printed |
| 6 | Watchdog arms automatically (workflow file presence checked) | `.github/workflows/post-merge-watchdog.yml` |

### Manual verification

Open the preview URL in a browser:
- Form renders with email + phone fields
- Submitting empty form shows validation errors
- Submitting valid data inserts a row into Supabase `leads` table (verify in Supabase Studio)

### Pass/fail

- **Pass:** preview URL works + form functional + coverage ≥ 80%/90%.
- **Fail mode 1: Plan Mode shows wrong scope** — Reject. See `runbooks/plan-mode-rejection.md`.
- **Fail mode 2: Gate 4 coverage shortfall** — V5 auto-generates tests once. If still short, halts. Write the missing tests manually + reissue.
- **Fail mode 3: Vercel preview never resolves** — `vercel.sh wait-preview` returns TIMEOUT after 60s, falls back to `vercel ls --json`. If still empty, the MCP `vibe-vercel/wait_for_preview` with `timeout_s: 300` may catch it; otherwise inspect Vercel dashboard for build errors.

---

## V2 — Second feature: leads list with status filter

**Prompt:** > Build feature: list view of leads with filtering by status

**Spec pass criterion:** *"Same flow; filters work in preview; coverage hits 80%/90%."*

Re-run the full pipeline. This validates V1 wasn't a one-off — V5 handles consecutive feature builds with the patterns from V1 in `memory/learned/<product-slug>/patterns.md` informing V2's directive.

### Verify

- Preview URL of V2's feature branch shows a leads list page
- Status filter toggles re-render the list correctly
- Coverage report still ≥ 80%/90%
- `memory/learned/<slug>/patterns.md` has at least one entry from V1 that influenced V2

---

## V3 — Audit

**Prompt:** > Audit codebase for vulnerabilities

**Spec pass criterion:** *"Security findings surfaced; CRITICAL count = 0; HIGH/MEDIUM auto-fixed in parallel; report generated in `memory/logs/security/`."*

V5 should:
1. Use the `vibe-secret-scanner` MCP `scan_paths` tool against the whole repo
2. Collect findings, sort by severity
3. CRITICAL findings → halt + auto-fix loop (max 3 attempts)
4. HIGH/MEDIUM/LOW findings → auto-fix in parallel, log, continue
5. Write summary to `memory/logs/security/<date>.jsonl`

### Pass/fail

- **Pass:** CRITICAL count = 0 after auto-fix loop; report generated.
- **Fail mode:** auto-fix loop exhausts 3 attempts → operator must manually fix and rerun.

---

## V4 — Merge V1 to main, watchdog confirms green

### Steps

```bash
cd "C:/Users/ragha/Desktop/ai-crm"
gh pr create --base main --head feature/lead-capture-form --title "feat: lead capture form" --body "V1 of validation"
# Review the PR diff in your browser
gh pr merge --squash --delete-branch
```

**Spec pass criterion:** *"Watchdog runs, confirms green, dismisses."*

### Verify

```bash
gh run list --workflow post-merge-watchdog.yml --limit 1
gh run view <run-id> --log
```

Look for:
- Job `ci`: build + test + smoke + regression all pass
- Job `watchdog`: `consecutive=0` (because CI passed) → "watchdog clean — main is green"
- No auto-revert action; no GitHub issue opened with `auto-revert` label

---

## V5 — Induce regression, watchdog auto-reverts

### Steps

```bash
cd "C:/Users/ragha/Desktop/ai-crm"
git checkout main && git pull
# Manually break a working test — e.g. introduce a typo in a leads.test.ts assertion
sed -i 's/expect(result.email)/expect(result.eemail)/' tests/leads.test.ts
git add tests/leads.test.ts
git commit -m "intentional: break leads test for V5 watchdog validation"
git push origin main
```

**Spec pass criterion:** *"Watchdog detects, auto-reverts, logs to `memory/logs/regressions/`, opens GitHub issue with full context."*

### What should happen

- First push: CI red. Watchdog logs cooldown ("1 consecutive red, waiting").
- (You may need a second push to satisfy the 2-consecutive-red rule. Easiest: a no-op commit.)
   ```bash
   git commit --allow-empty -m "trigger second watchdog cycle"
   git push origin main
   ```
- Second push: CI red again. Watchdog detects `consecutive=2` → triggers `scripts/v5/auto-revert.sh`.
- `auto-revert.sh`:
  1. `git revert -m 1 <merge-sha> --no-edit` on `main`
  2. `git push origin main`
  3. Recreates the feature branch from before-revert state
  4. Writes entry to `memory/logs/regressions/<date>.jsonl`
  5. Opens GitHub issue with `auto-revert,regression` labels

### Verify

```bash
gh issue list --label auto-revert
gh issue view <issue-number>
cat memory/logs/regressions/$(date -u +%F).jsonl
git log main -3       # most recent commit should be the revert
```

### Cleanup after V5

After validating, restore main to a clean known-good state:

```bash
git checkout main && git pull          # has the revert
gh issue close <auto-revert-issue> --comment "validation pass"
git push origin :feature/<slug>        # clean up the recreated branch
```

---

## Acceptance: all V0–V5 pass on first attempt

Per spec §11 phase E DoD: "All five validation steps pass on first attempt." (The numbering V0–V5 = 6 steps; spec text says "five" but tabulates 6. Treat all 6 as required.)

If anything failed → V5 stays at `5.0.0-rc.N`. Diagnose, fix, re-run the failed step. When all 6 pass on a single end-to-end run, proceed to Phase F (cutover).
