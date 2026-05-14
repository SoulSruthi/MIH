import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, statSync, writeFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const INIT_SCRIPT = join(REPO_ROOT, "plugin", "bin", "init.mjs");

function runInit(args) {
  return new Promise((resolveP) => {
    const child = spawn("node", [INIT_SCRIPT, ...args], { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolveP({ code, stdout, stderr }));
  });
}

function makeTmp() {
  return mkdtempSync(join(tmpdir(), "vibe-init-"));
}
function clean(d) {
  try { rmSync(d, { recursive: true, force: true }); } catch {}
}

test("init: scaffolds a fresh empty target with all expected paths (PC-3)", async () => {
  const tmp = makeTmp();
  try {
    const r = await runInit([tmp]);
    assert.equal(r.code, 0, `init failed: ${r.stderr}`);
    // Required paths
    const expected = [
      ".claude/hooks/PreToolUse.mjs",
      ".claude/hooks/PostToolUse.mjs",
      ".claude/hooks/SessionStart.mjs",
      ".claude/hooks/Stop.mjs",
      ".claude/hooks/SubagentStop.mjs",
      ".claude/settings.json",
      ".claude/skills/supabase-rls-policy/SKILL.md",
      ".claude/skills/directive-from-prompt/SKILL.md",
      ".claude/agents/feature-builder.md",
      ".claude/agents/security-scanner.md",
      "policy/001-structural-integrity.md",
      "baseline/011-hook-contract.md",
      "baseline/012-subagent-contract.md",
      "runbooks/gate-3-failure.md",
      "memory/project-init.md",
      "directives/.gitkeep",
      "memory/logs/execution/.gitkeep",
    ];
    for (const p of expected) {
      assert.ok(existsSync(join(tmp, p)), `missing: ${p}`);
    }
  } finally {
    clean(tmp);
  }
});

test("init: refuses to overwrite without --force or --reuse-existing (PC-4)", async () => {
  const tmp = makeTmp();
  try {
    // Pre-create a conflicting file.
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "settings.json"), '{"existing": true}', "utf8");

    const r = await runInit([tmp]);
    assert.equal(r.code, 1, "expected non-zero exit on conflict");
    assert.match(r.stderr, /conflicting|conflict/i);
  } finally {
    clean(tmp);
  }
});

test("init: --reuse-existing keeps pre-existing files", async () => {
  const tmp = makeTmp();
  try {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "settings.json"), '{"existing": true}', "utf8");

    const r = await runInit([tmp, "--reuse-existing"]);
    assert.equal(r.code, 0, `init failed: ${r.stderr}`);
    const content = readFileSync(join(tmp, ".claude", "settings.json"), "utf8");
    assert.match(content, /"existing": true/);
  } finally {
    clean(tmp);
  }
});

test("init: --force overwrites existing files", async () => {
  const tmp = makeTmp();
  try {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "settings.json"), '{"existing": true}', "utf8");

    const r = await runInit([tmp, "--force"]);
    assert.equal(r.code, 0);
    const content = readFileSync(join(tmp, ".claude", "settings.json"), "utf8");
    assert.doesNotMatch(content, /"existing": true/);
    assert.match(content, /"hooks":/);
  } finally {
    clean(tmp);
  }
});

test("init: refuses to scaffold the OS source repo onto itself (PC-5)", async () => {
  const r = await runInit([REPO_ROOT]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /onto itself/i);
});

test("init: --dry-run does not write to target", async () => {
  const tmp = makeTmp();
  try {
    const r = await runInit([tmp, "--dry-run"]);
    assert.equal(r.code, 0);
    // Nothing should have been written.
    assert.ok(!existsSync(join(tmp, ".claude")));
    assert.ok(!existsSync(join(tmp, "policy")));
  } finally {
    clean(tmp);
  }
});

test("init: excludes runtime hook logs (.claude/hooks/log/) from scaffold", async () => {
  const tmp = makeTmp();
  try {
    await runInit([tmp]);
    assert.ok(!existsSync(join(tmp, ".claude", "hooks", "log")), "scaffold leaked hook runtime log dir");
  } finally {
    clean(tmp);
  }
});

test("init: writes memory/project-init.md marker", async () => {
  const tmp = makeTmp();
  try {
    await runInit([tmp]);
    const marker = join(tmp, "memory", "project-init.md");
    assert.ok(existsSync(marker));
    const content = readFileSync(marker, "utf8");
    assert.match(content, /Initialized by:.*vibe-os/);
  } finally {
    clean(tmp);
  }
});
