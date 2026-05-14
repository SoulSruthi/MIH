# Structure Guardian MCP

**MCP Name:** structure-guardian
**Version:** 1.0
**Status:** Active
**Authority Level:** Constitutional
**Effective Date:** 2026-01-24

---

## Overview

The Structure Guardian is a **pre-execution validation MCP** that enforces repository structural integrity before any other MCP is allowed to operate.

It operates in **READ-ONLY** mode and serves as the first line of defense against:
- Structural drift
- Locked file tampering
- Directory schema violations
- Baseline corruption

---

## Responsibility

**Single Domain:** Filesystem structural validation

The Structure Guardian:
- Validates directory structure against declared schema
- Verifies locked file integrity via hash comparison
- Detects unauthorized modifications to immutable files
- Reports violations with exact file paths and broken invariants

The Structure Guardian does NOT:
- Suggest fixes
- Modify files
- Attempt repairs
- Proceed on partial validation

---

## Authority Level

**Constitutional (Highest)**

The Structure Guardian outranks all MCPs except explicit Policy Locks.

**Enforcement Rule:**
- If Structure Guardian returns `STRUCTURE_FAIL`, all other MCPs **MUST HALT**
- No MCP may proceed until structural integrity is restored
- No override mechanism exists

---

## Output Guarantees

The Structure Guardian returns ONLY one of two states:

1. **STRUCTURE_OK** — All validations passed
2. **STRUCTURE_FAIL** — One or more violations detected

If `STRUCTURE_FAIL`, the output includes:
- List of violations with exact file paths
- Which invariant was broken
- No suggested fixes (enforcement only)

---

## Validation Checks

The Structure Guardian performs the following checks:

1. **Required directories exist** exactly as declared in schema
2. **No forbidden directories exist** (e.g., temp folders, drift)
3. **Locked files exist** and are present at declared paths
4. **Locked files match stored hashes** (no tampering)
5. **No structural drift** from declared schema

---

## Trusted Files

The Structure Guardian reads and trusts:

- `/baseline/structure.schema.json` — Canonical directory structure
- `/baseline/locked-files.md` — List of immutable files
- `/baseline/hashes.json` — SHA-256 hashes of locked files
- `/policy/*` — All policy files
- `/directives/*` — All directive files

---

## Integration Point

**When invoked:** Before any MCP operation

**Invocation pattern:**
```
User Request
    ↓
Structure Guardian Validation
    ↓
[STRUCTURE_OK] → Proceed to other MCPs
[STRUCTURE_FAIL] → HALT, report violations
```

---

## Failure Mode

**On validation failure:**
- Return `STRUCTURE_FAIL`
- List all violations
- Trigger global MCP HALT
- No MCP may proceed

**Non-negotiable rule:**
- Incomplete validation = FAILURE
- Silence or ambiguity = FAILURE
- Partial success = FAILURE

---

## Dependencies

**Allowed Dependencies:**
- Filesystem read access
- `/baseline/structure.schema.json`
- `/baseline/locked-files.md`
- `/baseline/hashes.json`

**Forbidden Dependencies:**
- No write access to any file
- No external network calls
- No modification capabilities
- No other MCP dependencies

---

## Version History

**v1.0** (2026-01-24) — Initial Structure Guardian MCP

---

## Related Documents

- **BASELINE 003** — MCP Contract
- **POLICY 001** — Structural Integrity
- **POLICY 005** — MCP Interaction Authority
- **Directive 003** — Authorize MCP System Creation

---

## Compliance

This MCP is compliant with:
- BASELINE 003 (MCP Contract)
- POLICY 001 (Structural Integrity)
- POLICY 005 (MCP Interaction Authority)

**Authority:** Constitutional
**Immutability:** Locked under BASELINE 003
