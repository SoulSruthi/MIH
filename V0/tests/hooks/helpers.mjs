import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, rmSync, mkdtempSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..");
export const HOOK_DIR = join(REPO_ROOT, ".claude", "hooks");

export function runHook(hookName, stdinObj, opts = {}) {
  return new Promise((resolveP) => {
    const cwd = opts.cwd || REPO_ROOT;
    const child = spawn("node", [join(HOOK_DIR, `${hookName}.mjs`)], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolveP({ code, stdout, stderr }));
    child.stdin.write(JSON.stringify(stdinObj));
    child.stdin.end();
  });
}

// Make a sandbox repo copy so tests don't pollute the real memory/logs/.
export function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), "vibe-hooks-"));
  // Copy the .claude/hooks tree (so relative paths resolve).
  mkdirSync(join(dir, ".claude"), { recursive: true });
  cpSync(join(REPO_ROOT, ".claude", "hooks"), join(dir, ".claude", "hooks"), { recursive: true });
  // Stub minimal repo dirs the hooks read.
  for (const sub of ["memory/logs/execution", "memory/logs/subagents", "memory/learned", "directives", "policy", "baseline"]) {
    mkdirSync(join(dir, sub), { recursive: true });
  }
  return dir;
}

export function cleanSandbox(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
