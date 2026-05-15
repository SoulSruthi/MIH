import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, ".claude", "skills");

const REQUIRED_SKILLS = [
  "supabase-rls-policy",
  "shadcn-component-install",
  "vitest-from-spec",
  "secret-fix-and-relocate",
  "directive-from-prompt",
  "migration-supabase-safe",
];

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  const block = text.slice(3, end).trim();
  const obj = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) obj[m[1]] = m[2];
  }
  return obj;
}

test("Skills: all 6 V5 skills present (FR-2.1)", () => {
  for (const name of REQUIRED_SKILLS) {
    const dir = join(SKILLS_DIR, name);
    assert.ok(existsSync(dir), `missing skill folder: ${name}`);
    assert.ok(statSync(dir).isDirectory(), `${name} is not a directory`);
    assert.ok(existsSync(join(dir, "SKILL.md")), `${name} missing SKILL.md`);
  }
});

test("Skills: each SKILL.md has valid frontmatter (FR-2.2)", () => {
  for (const name of REQUIRED_SKILLS) {
    const file = join(SKILLS_DIR, name, "SKILL.md");
    const text = readFileSync(file, "utf8");
    const fm = parseFrontmatter(text);
    assert.ok(fm, `${name}: SKILL.md missing or malformed frontmatter`);
    assert.equal(fm.name, name, `${name}: frontmatter name doesn't match folder`);
    assert.ok(fm.description, `${name}: frontmatter missing description`);
  }
});

test("Skills: description is ≤200 chars (FR-2.2)", () => {
  for (const name of REQUIRED_SKILLS) {
    const file = join(SKILLS_DIR, name, "SKILL.md");
    const text = readFileSync(file, "utf8");
    const fm = parseFrontmatter(text);
    assert.ok(
      fm.description.length <= 200,
      `${name}: description is ${fm.description.length} chars (limit 200)`
    );
  }
});

test("Skills: description uses imperative trigger pattern (FR-2.2)", () => {
  // "Use this skill when ..." or "Use this when ..." — pattern-matching imperative.
  const ok = /^Use this (skill )?when\b/i;
  for (const name of REQUIRED_SKILLS) {
    const file = join(SKILLS_DIR, name, "SKILL.md");
    const text = readFileSync(file, "utf8");
    const fm = parseFrontmatter(text);
    assert.match(fm.description, ok, `${name}: description should start with "Use this when ..."`);
  }
});

test("Skills: trigger fixtures cover every required skill", () => {
  const fixtures = JSON.parse(
    readFileSync(join(HERE, "triggers.fixtures.json"), "utf8")
  );
  const covered = new Set(fixtures.cases.map((c) => c.expected_skill));
  for (const name of REQUIRED_SKILLS) {
    assert.ok(covered.has(name), `no trigger fixture for skill: ${name}`);
  }
});

test("Skills: each trigger fixture references a real skill", () => {
  const fixtures = JSON.parse(
    readFileSync(join(HERE, "triggers.fixtures.json"), "utf8")
  );
  for (const c of fixtures.cases) {
    assert.ok(
      existsSync(join(SKILLS_DIR, c.expected_skill, "SKILL.md")),
      `fixture references missing skill: ${c.expected_skill}`
    );
  }
});

test("Skills: no skill imports from another skill (FR-2.4 self-contained)", () => {
  for (const name of REQUIRED_SKILLS) {
    const file = join(SKILLS_DIR, name, "SKILL.md");
    const text = readFileSync(file, "utf8");
    const others = REQUIRED_SKILLS.filter((s) => s !== name);
    for (const other of others) {
      // Allow casual references in prose ("see also: ..."), but no "Load skill: <other>" or import-y syntax.
      assert.doesNotMatch(
        text,
        new RegExp(`(load|require|import)\\s+(skill\\s+)?['"]?${other}['"]?`, "i"),
        `${name} appears to load ${other} (FR-2.4 violation)`
      );
    }
  }
});
