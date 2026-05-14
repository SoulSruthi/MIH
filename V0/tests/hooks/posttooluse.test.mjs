import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, makeSandbox, cleanSandbox, readJsonl, todayDate } from "./helpers.mjs";
import { join } from "node:path";

test("PostToolUse: appends a jsonl entry for a tool call", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PostToolUse",
      {
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_response: { stdout: "file.txt\n" },
        session_id: "test-session-1",
      },
      { cwd: sb }
    );
    assert.equal(r.code, 0);
    const entries = readJsonl(join(sb, "memory", "logs", "execution", `${todayDate()}.jsonl`));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].tool, "Bash");
    assert.equal(entries[0].session_id, "test-session-1");
    assert.match(entries[0].tool_input, /ls/);
  } finally {
    cleanSandbox(sb);
  }
});

test("PostToolUse: never blocks (always exit 0)", async () => {
  const sb = makeSandbox();
  try {
    const r = await runHook(
      "PostToolUse",
      { tool_name: "AnythingWeird", tool_input: {}, tool_response: {} },
      { cwd: sb }
    );
    assert.equal(r.code, 0);
  } finally {
    cleanSandbox(sb);
  }
});

test("PostToolUse: handles malformed input without crashing", async () => {
  const sb = makeSandbox();
  try {
    // Send a string instead of JSON object via the helper — simulate an edge case.
    // We pass a normal object but with no fields. The hook must still exit 0.
    const r = await runHook("PostToolUse", {}, { cwd: sb });
    assert.equal(r.code, 0);
  } finally {
    cleanSandbox(sb);
  }
});
