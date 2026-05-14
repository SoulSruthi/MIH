// V5 secret-scanner MCP smoke tests.
// Boots the stdio server as a subprocess, sends JSON-RPC, asserts shape.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SERVER = resolve(REPO_ROOT, "scripts/mcp/secret-scanner/server.mjs");

function startServer() {
  const child = spawn("node", [SERVER], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
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
        try { messages.push(JSON.parse(line)); } catch { /* skip non-JSON */ }
      }
    }
  });
  return { child, messages };
}

function send(child, msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

async function waitFor(messages, predicate, ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = messages.find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timeout waiting for message; saw ${messages.length}: ${JSON.stringify(messages).slice(0, 400)}`);
}

test("secret-scanner MCP: initialize + tools/list returns scan_paths and scan_text", async () => {
  const { child, messages } = startServer();
  try {
    send(child, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "0" },
      },
    });
    await waitFor(messages, (m) => m.id === 1);

    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const list = await waitFor(messages, (m) => m.id === 2);

    assert.ok(list.result?.tools, `tools/list missing result.tools: ${JSON.stringify(list)}`);
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["scan_paths", "scan_text"]);
  } finally {
    child.kill();
  }
});

test("secret-scanner MCP: scan_text flags a planted Stripe live secret", async () => {
  const { child, messages } = startServer();
  try {
    send(child, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-test", version: "0" } },
    });
    await waitFor(messages, (m) => m.id === 1);
    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    const planted = `const stripe = require("stripe")("sk_live_" + "AbCdEfGhIjKlMnOpQrStUvWx12345");`;
    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "scan_text", arguments: { content: planted, file_hint: "src/lib/payments.ts" } },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);

    assert.ok(resp.result?.content?.[0]?.text, `tools/call missing content: ${JSON.stringify(resp)}`);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.ok(Array.isArray(payload.findings), "findings should be array");
    assert.ok(payload.findings.length >= 1, `expected at least 1 finding, got ${payload.findings.length}`);
    const stripeHit = payload.findings.find((f) => f.pattern.includes("Stripe"));
    assert.ok(stripeHit, `expected a Stripe finding, got: ${JSON.stringify(payload.findings)}`);
    assert.equal(stripeHit.severity, "CRITICAL");
    assert.equal(stripeHit.file, "src/lib/payments.ts");
  } finally {
    child.kill();
  }
});

test("secret-scanner MCP: scan_text on clean content returns empty findings", async () => {
  const { child, messages } = startServer();
  try {
    send(child, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-test", version: "0" } },
    });
    await waitFor(messages, (m) => m.id === 1);
    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    send(child, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "scan_text", arguments: { content: "export function add(a, b) { return a + b; }" } },
    });
    const resp = await waitFor(messages, (m) => m.id === 2);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.equal(payload.findings.length, 0);
    assert.deepEqual(payload.summary, { critical: 0, high: 0, medium: 0, low: 0 });
  } finally {
    child.kill();
  }
});
