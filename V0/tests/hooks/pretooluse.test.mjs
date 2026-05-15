import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, makeSandbox, cleanSandbox, readJsonl, todayDate } from "./helpers.mjs";
import { join } from "node:path";

test("PreToolUse: blocks Write to policy/", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      {
        tool_name: "Write",
        tool_input: { file_path: join(sb, "policy", "_test.md"), content: "x" },
      },
      { cwd: sb }
    );
    assert.equal(r.code, 2, `expected exit 2, got ${r.code}; stderr=${r.stderr}`);
    assert.match(r.stderr, /BLOCKED/);
    assert.match(r.stderr, /policy/);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: blocks Edit to baseline/", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      {
        tool_name: "Edit",
        tool_input: { file_path: join(sb, "baseline", "001-repo-template.md") },
      },
      { cwd: sb }
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /baseline/);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: blocks Write to .env.local", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      { tool_name: "Write", tool_input: { file_path: join(sb, ".env.local") } },
      { cwd: sb }
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /\.env\.local/);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: allows Write to .env.example", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      { tool_name: "Write", tool_input: { file_path: join(sb, ".env.example") } },
      { cwd: sb }
    );
    assert.equal(r.code, 0, `expected allow; stderr=${r.stderr}`);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: allows Write to src/", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      { tool_name: "Write", tool_input: { file_path: join(sb, "src", "foo.ts") } },
      { cwd: sb }
    );
    assert.equal(r.code, 0);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: blocks Bash 'rm -rf .git'", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      { tool_name: "Bash", tool_input: { command: "rm -rf .git" } },
      { cwd: sb }
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /dangerous|rm -rf/);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: blocks Bash containing AWS key pattern", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      { tool_name: "Bash", tool_input: { command: "echo AKIAIOSFODNN7EXAMPLE" } },
      { cwd: sb }
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /secret/);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: allows benign Bash", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PreToolUse",
      { tool_name: "Bash", tool_input: { command: "ls -la" } },
      { cwd: sb }
    );
    assert.equal(r.code, 0);
  } finally {
    cleanSandbox(sb);
  }
});

test("PreToolUse: a block writes an audit-log entry", async () => {
  const sb = makeSandbox();
  try {
    await runHook(
      "PreToolUse",
      { tool_name: "Write", tool_input: { file_path: join(sb, "policy", "_test.md") } },
      { cwd: sb }
    );
    const entries = readJsonl(join(sb, "memory", "logs", "execution", `${todayDate()}.jsonl`));
    const blocks = entries.filter((e) => e.decision === "block");
    assert.ok(blocks.length >= 1, "expected at least one block entry in audit log");
    assert.equal(blocks[0].hook, "PreToolUse");
  } finally {
    cleanSandbox(sb);
  }
});
