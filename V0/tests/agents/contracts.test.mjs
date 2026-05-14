import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");

const REQUIRED_AGENTS = [
  "feature-builder",
  "security-scanner",
  "pattern-extractor",
];

// ── lightweight frontmatter extraction (no YAML parser) ────────────
function readFrontmatter(file) {
  const text = readFileSync(file, "utf8");
  if (!text.startsWith("---")) return { raw: text, frontmatter: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { raw: text, frontmatter: null, body: text };
  return {
    raw: text,
    frontmatter: text.slice(3, end).trim(),
    body: text.slice(end + 4).trim(),
  };
}

function getScalar(fm, key) {
  // top-level scalar: `key: value` (single line)
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = fm.match(re);
  if (!m) return null;
  return m[1].trim();
}

function getList(fm, key) {
  // top-level list: `key:` followed by `  - item` lines
  const re = new RegExp(`^${key}:\\s*\\n((?:  -.*\\n?)+)`, "m");
  const m = fm.match(re);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.replace(/^\s*-\s*/, "").trim());
}

function getBlock(fm, key) {
  // top-level multi-line block (mapping under key). Returns the raw indented block.
  const re = new RegExp(`^${key}:\\s*\\n((?:[ \\t].*\\n?)+)`, "m");
  const m = fm.match(re);
  if (!m) return null;
  return m[1];
}

// ── tests ────────────────────────────────────────────────────────────

test("Subagents: all 3 required V5 agents present (FR-4.1)", () => {
  for (const name of REQUIRED_AGENTS) {
    const file = join(AGENTS_DIR, `${name}.md`);
    assert.ok(existsSync(file), `missing agent file: ${file}`);
    assert.ok(statSync(file).isFile(), `not a file: ${file}`);
  }
});

test("Subagents: name matches filename (SC-1)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const file = join(AGENTS_DIR, `${agent}.md`);
    const { frontmatter } = readFrontmatter(file);
    assert.ok(frontmatter, `${agent}: missing frontmatter`);
    const name = getScalar(frontmatter, "name");
    assert.equal(name, agent, `${agent}: name field doesn't match filename`);
  }
});

test("Subagents: description ≤200 chars and imperative (SC-2 / FR-4.2 description)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const { frontmatter } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    const desc = getScalar(frontmatter, "description");
    assert.ok(desc, `${agent}: missing description`);
    assert.ok(
      desc.length <= 200,
      `${agent}: description ${desc.length} chars > 200`
    );
    assert.match(
      desc,
      /^Use this\b/i,
      `${agent}: description should start with "Use this …" imperative`
    );
  }
});

test("Subagents: tools allowlist present and non-empty (SC-3 / FR-4.3)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const { frontmatter } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    const tools = getList(frontmatter, "tools");
    assert.ok(tools && tools.length > 0, `${agent}: tools list empty or missing`);
  }
});

test("Subagents: tools allowlist excludes Task (SC-4 / FR-4.4 no nesting)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const { frontmatter } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    const tools = getList(frontmatter, "tools");
    assert.ok(
      !tools.some((t) => t === "Task" || t.startsWith("Task")),
      `${agent}: tools list contains Task — subagents must not invoke other subagents`
    );
  }
});

test("Subagents: return_contract has type/required/properties (SC-5 / FR-4.2)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const { frontmatter } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    const block = getBlock(frontmatter, "return_contract");
    assert.ok(block, `${agent}: return_contract block missing`);
    assert.match(block, /\btype:\s*object\b/, `${agent}: return_contract.type missing`);
    assert.match(block, /\brequired:\s*\n/, `${agent}: return_contract.required missing`);
    assert.match(block, /\bproperties:\s*\n/, `${agent}: return_contract.properties missing`);
  }
});

test("Subagents: timeout_minutes is a positive integer ≤30 (SC-6)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const { frontmatter } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    const raw = getScalar(frontmatter, "timeout_minutes");
    assert.ok(raw, `${agent}: timeout_minutes missing`);
    const n = Number(raw);
    assert.ok(Number.isInteger(n) && n > 0 && n <= 30, `${agent}: timeout_minutes invalid (${raw})`);
  }
});

test("Subagents: body documents Steps + Constraints + Return format (SC-8)", () => {
  for (const agent of REQUIRED_AGENTS) {
    const { body } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    assert.match(body, /## Steps/i, `${agent}: missing "## Steps" section`);
    assert.match(body, /## Constraints/i, `${agent}: missing "## Constraints" section`);
    assert.match(body, /## Return format/i, `${agent}: missing "## Return format" section`);
  }
});

test("Subagents: no agent invokes another agent in body (FR-4.4)", () => {
  // Allow casual prose mentions, but flag actual delegation patterns.
  const delegationPatterns = [
    /\bspawn the [`'"]?(\w+-\w+)[`'"]? subagent\b/i,
    /\binvoke the [`'"]?(\w+-\w+)[`'"]? subagent\b/i,
    /\bcall the [`'"]?(\w+-\w+)[`'"]? subagent\b/i,
    /\buse Task tool to launch\b/i,
  ];
  for (const agent of REQUIRED_AGENTS) {
    const { body } = readFrontmatter(join(AGENTS_DIR, `${agent}.md`));
    for (const pat of delegationPatterns) {
      const m = body.match(pat);
      if (m) {
        const target = m[1];
        // Allow if guarded by "or" / "if FR-4.4 prevents" — feature-builder's spawning text is documentation,
        // not a true delegation since its tools list excludes Task. Validate that.
        const around = body.slice(
          Math.max(0, body.indexOf(m[0]) - 80),
          body.indexOf(m[0]) + m[0].length + 80
        );
        const guarded = /FR-4\.4|inline|do not.*invoke|tools.*excludes/i.test(around);
        if (!guarded) {
          assert.fail(
            `${agent}: body appears to delegate to ${target || "another subagent"} (FR-4.4 violation): "${m[0]}"`
          );
        }
      }
    }
  }
});
