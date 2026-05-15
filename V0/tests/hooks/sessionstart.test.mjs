import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, makeSandbox, cleanSandbox } from "./helpers.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

test("SessionStart: emits context summary on stdout", async () => {
  const sb = makeSandbox();
  try {
    writeFileSync(
      join(sb, "memory", "learned", "patterns.md"),
      "# Patterns\n- prefer Vitest\n",
      "utf8"
    );
    writeFileSync(join(sb, "directives", "001-test.md"), "# test directive\n", "utf8");

    const r = await runHook("SessionStart", {}, { cwd: sb });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /Vibe OS V4/);
    assert.match(r.stdout, /001-test\.md/);
    assert.match(r.stdout, /Hooks Active/);
  } finally {
    cleanSandbox(sb);
  }
});

test("SessionStart: stays under ~2000 chars (≈500 tokens)", async () => {
  const sb = makeSandbox();
  try {
    // Generate a huge patterns file; expect truncation.
    writeFileSync(
      join(sb, "memory", "learned", "patterns.md"),
      "# Patterns\n" + "- pattern line\n".repeat(2000),
      "utf8"
    );
    const r = await runHook("SessionStart", {}, { cwd: sb });
    assert.equal(r.code, 0);
    assert.ok(r.stdout.length < 2200, `expected ≤2200 chars, got ${r.stdout.length}`);
  } finally {
    cleanSandbox(sb);
  }
});
