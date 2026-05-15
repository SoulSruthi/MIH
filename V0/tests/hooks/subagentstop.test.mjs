import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, makeSandbox, cleanSandbox, readJsonl, todayDate } from "./helpers.mjs";
import { join } from "node:path";

test("SubagentStop: logs payload to subagents/<date>.jsonl", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "SubagentStop",
      {
        session_id: "sub-1",
        transcript_path: "/tmp/x.json",
        result: { directive_id: "021", status: "success" },
      },
      { cwd: sb }
    );
    assert.equal(r.code, 0);
    const entries = readJsonl(join(sb, "memory", "logs", "subagents", `${todayDate()}.jsonl`));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].session_id, "sub-1");
    assert.match(entries[0].payload_summary, /021/);
  } finally {
    cleanSandbox(sb);
  }
});
