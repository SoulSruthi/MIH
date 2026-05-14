import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, makeSandbox, cleanSandbox } from "./helpers.mjs";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

test("Stop: queues pattern-extraction when Gate 5 success exists today", async () => {
  const sb = makeSandbox();
  try {
    const today = new Date().toISOString();
    writeFileSync(
      join(sb, "memory", "logs", "gates.jsonl"),
      JSON.stringify({ ts: today, gate: 5, outcome: "success", directive: "021-test" }) + "\n",
      "utf8"
    );
    const r = await runHook("Stop", {}, { cwd: sb });
    assert.equal(r.code, 0);
    assert.ok(existsSync(join(sb, "memory", "logs", "pattern-extraction.queue")));
  } finally {
    cleanSandbox(sb);
  }
});

test("Stop: noop when no Gate 5 today", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook("Stop", {}, { cwd: sb });
    assert.equal(r.code, 0);
    assert.ok(!existsSync(join(sb, "memory", "logs", "pattern-extraction.queue")));
  } finally {
    cleanSandbox(sb);
  }
});
