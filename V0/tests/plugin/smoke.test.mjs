// V5 framework smoke test.
// VIBE_CODE_OS is generic scaffolding — there's no specific app to validate against.
// Instead we validate that init produces a self-consistent OS that materializes
// every framework layer the operator depends on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

function run(script, args, cwd) {
  return new Promise((resolveP) => {
    const child = spawn("node", [script, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolveP({ code, stdout, stderr }));
  });
}

function makeTmp() {
  return mkdtempSync(join(tmpdir(), "vibe-smoke-"));
}
function clean(d) {
  try { rmSync(d, { recursive: true, force: true }); } catch {}
}

test("M5 smoke: scaffold contains all framework layers", async () => {
  const tmp = makeTmp();
  try {
    const r = await run(join(REPO_ROOT, "plugin", "bin", "init.mjs"), [tmp], REPO_ROOT);
    assert.equal(r.code, 0, `init failed: ${r.stderr}`);

    // All V5 framework layers materialized in the scaffold
    const layers = {
      "Constitution (CLAUDE.md)": "CLAUDE.md",
      "Hooks (5)": ".claude/hooks/PreToolUse.mjs",
      "Skills (6)": ".claude/skills/supabase-rls-policy/SKILL.md",
      "Agents (3)": ".claude/agents/feature-builder.md",
      "Plugin (init only)": "plugin/bin/init.mjs",
      "Policies": "policy/001-structural-integrity.md",
      "Baselines": "baseline/012-subagent-contract.md",
      "Runbooks": "runbooks/gate-3-failure.md",
      "Bash orchestration": "scripts/v5/build.sh",
      "MCP servers": "scripts/mcp/secret-scanner/server.mjs",
      "Watchdog workflow": ".github/workflows/post-merge-watchdog.yml",
      "Secret scanner": "scripts/secret-scanner.ts",
    };
    for (const [layer, path] of Object.entries(layers)) {
      assert.ok(existsSync(join(tmp, path)), `missing ${layer}: ${path}`);
    }
  } finally {
    clean(tmp);
  }
});

test("M5 smoke: scaffold has no app-specific source code", async () => {
  const tmp = makeTmp();
  try {
    await run(join(REPO_ROOT, "plugin", "bin", "init.mjs"), [tmp], REPO_ROOT);

    // src/ exists but should only have .gitkeep
    const srcDir = join(tmp, "src");
    assert.ok(existsSync(srcDir));
    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(srcDir);
    assert.deepEqual(entries, [".gitkeep"], `src/ has unexpected contents: ${entries.join(", ")}`);

    // directives/ should be empty (just .gitkeep)
    const dirEntries = readdirSync(join(tmp, "directives"));
    assert.deepEqual(dirEntries, [".gitkeep"]);

    // execution/ should be empty
    const execEntries = readdirSync(join(tmp, "execution"));
    assert.deepEqual(execEntries, [".gitkeep"]);
  } finally {
    clean(tmp);
  }
});

test("V5 smoke: scaffold's templates include the recommended stack", async () => {
  const tmp = makeTmp();
  try {
    await run(join(REPO_ROOT, "plugin", "bin", "init.mjs"), [tmp], REPO_ROOT);

    const pkg = JSON.parse(readFileSync(join(tmp, "package.json"), "utf8"));
    // V5 stack contract (D-05): Next.js + TypeScript + Supabase + Vitest + Playwright + shadcn
    assert.ok(pkg.dependencies.next, "Next.js should be in template");
    assert.ok(pkg.dependencies["@supabase/ssr"], "Supabase should be in template");
    assert.ok(pkg.devDependencies.vitest, "Vitest should be in template");
    assert.ok(pkg.devDependencies["@playwright/test"], "Playwright should be in template");
    assert.ok(pkg.devDependencies.husky, "Husky should be in template");
  } finally {
    clean(tmp);
  }
});
