// V5 supabase MCP smoke tests.
// Boots the stdio server, asserts tools register, and confirms the missing-auth
// path returns a structured error (not a crash). Real API calls aren't tested
// here — that requires a live SUPABASE_ACCESS_TOKEN and is part of Phase E
// validation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SERVER = resolve(REPO_ROOT, "scripts/mcp/supabase/server.mjs");

function startServer(envOverrides = {}, cwd = REPO_ROOT) {
  const env = { ...process.env, ...envOverrides };
  for (const k of Object.keys(env)) {
    if (k.startsWith("SUPABASE_") && envOverrides[k] === undefined) delete env[k];
  }
  const child = spawn("node", [SERVER], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });
  let buf = "";
  const messages = [];
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try { messages.push(JSON.parse(line)); } catch { /* ignore non-JSON */ }
      }
    }
  });
  return { child, messages };
}

function send(child, msg) { child.stdin.write(JSON.stringify(msg) + "\n"); }

async function waitFor(messages, predicate, ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = messages.find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timeout; saw ${messages.length}: ${JSON.stringify(messages).slice(0, 400)}`);
}

async function handshake(child, messages) {
  send(child, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-test", version: "0" } },
  });
  await waitFor(messages, (m) => m.id === 1);
  send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
}

test("supabase MCP: tools/list returns list_branches, apply_migration_to_branch, wait_for_branch_ready", async () => {
  const { child, messages } = startServer();
  try {
    await handshake(child, messages);
    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const list = await waitFor(messages, (m) => m.id === 2);
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["apply_migration_to_branch", "list_branches", "wait_for_branch_ready"]);
  } finally {
    child.kill();
  }
});

test("supabase MCP: missing SUPABASE_ACCESS_TOKEN returns structured error", async () => {
  // Use a tmpdir as cwd so resolveProjectRef doesn't pick up the repo's
  // own supabase/config.toml (we don't have one, but defensive).
  const tmp = mkdtempSync(join(tmpdir(), "vibe-mcp-"));
  const { child, messages } = startServer({}, tmp);
  try {
    await handshake(child, messages);
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "list_branches", arguments: {} },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.ok(payload.error, `expected error, got: ${JSON.stringify(payload)}`);
    assert.match(payload.error, /SUPABASE_ACCESS_TOKEN/i);
    assert.equal(resp.result.isError, true);
  } finally {
    child.kill();
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows EPERM on tmpdir cleanup — child handle still releasing; harmless */ }
  }
});

test("supabase MCP: token without project ref returns structured error", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "vibe-mcp-"));
  const { child, messages } = startServer({ SUPABASE_ACCESS_TOKEN: "fake-for-test" }, tmp);
  try {
    await handshake(child, messages);
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "list_branches", arguments: {} },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.ok(payload.error);
    assert.match(payload.error, /SUPABASE_PROJECT_REF|config\.toml/i);
  } finally {
    child.kill();
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows EPERM on tmpdir cleanup — child handle still releasing; harmless */ }
  }
});

test("supabase MCP: apply_migration_to_branch with missing file returns structured error", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "vibe-mcp-"));
  // Even without auth, the existence-of-file check should fire first when
  // path is non-existent — but the order in the impl is: existence first,
  // then auth. Let me assert the error contains 'not found'.
  const { child, messages } = startServer({
    SUPABASE_ACCESS_TOKEN: "fake-for-test",
    SUPABASE_PROJECT_REF: "fakeprojectref",
  }, tmp);
  try {
    await handshake(child, messages);
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "apply_migration_to_branch", arguments: { migration_path: "/nonexistent/path/to/migration.sql" } },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.ok(payload.error);
    assert.match(payload.error, /not found/i);
  } finally {
    child.kill();
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows EPERM on tmpdir cleanup — child handle still releasing; harmless */ }
  }
});

test("supabase MCP: apply_migration with empty file returns structured error", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "vibe-mcp-"));
  const emptyMig = join(tmp, "empty.sql");
  writeFileSync(emptyMig, "   \n  \n");
  const { child, messages } = startServer({
    SUPABASE_ACCESS_TOKEN: "fake-for-test",
    SUPABASE_PROJECT_REF: "fakeprojectref",
  }, tmp);
  try {
    await handshake(child, messages);
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "apply_migration_to_branch", arguments: { migration_path: emptyMig } },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.ok(payload.error);
    assert.match(payload.error, /empty/i);
  } finally {
    child.kill();
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows EPERM on tmpdir cleanup — child handle still releasing; harmless */ }
  }
});
