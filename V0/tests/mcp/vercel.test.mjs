// V5 vercel MCP smoke tests.
// Boots the stdio server, asserts tools register, and confirms the missing-auth
// path returns a structured error (not a crash). Real API calls aren't tested
// here — that requires a live VERCEL_TOKEN and is part of Phase E validation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SERVER = resolve(REPO_ROOT, "scripts/mcp/vercel/server.mjs");

function startServer(envOverrides = {}) {
  // Strip VERCEL_* from the parent env so tests run deterministically
  // regardless of operator's local config.
  const env = { ...process.env, ...envOverrides };
  for (const k of Object.keys(env)) {
    if (k.startsWith("VERCEL_") && envOverrides[k] === undefined) delete env[k];
  }
  const child = spawn("node", [SERVER], {
    cwd: REPO_ROOT,
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

test("vercel MCP: tools/list returns wait_for_preview, get_deploy_status, redeploy", async () => {
  const { child, messages } = startServer();
  try {
    await handshake(child, messages);
    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const list = await waitFor(messages, (m) => m.id === 2);
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["get_deploy_status", "redeploy", "wait_for_preview"]);
  } finally {
    child.kill();
  }
});

test("vercel MCP: missing VERCEL_TOKEN returns structured error, not crash", async () => {
  const { child, messages } = startServer();
  try {
    await handshake(child, messages);
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "get_deploy_status", arguments: { deployment_id: "dpl_fake" } },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    assert.ok(resp.result?.content?.[0]?.text, `missing content: ${JSON.stringify(resp)}`);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.ok(payload.error, `expected error key, got: ${JSON.stringify(payload)}`);
    assert.match(payload.error, /VERCEL_TOKEN/i);
    assert.equal(resp.result.isError, true);
  } finally {
    child.kill();
  }
});

test("vercel MCP: missing project linkage returns structured error", async () => {
  const { child, messages } = startServer({ VERCEL_TOKEN: "fake-for-test" });
  try {
    await handshake(child, messages);
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "wait_for_preview", arguments: { branch: "feature/x", timeout_s: 1 } },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    const payload = JSON.parse(resp.result.content[0].text);
    // Either VERCEL_PROJECT_ID or .vercel/project.json. In test env, neither exists in the repo.
    assert.ok(payload.error, `expected error, got: ${JSON.stringify(payload)}`);
    assert.match(payload.error, /VERCEL_PROJECT_ID|project.json|not linked/i);
  } finally {
    child.kill();
  }
});
