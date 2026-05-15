# Directive Resolver MCP

**MCP Name:** directive-resolver
**Version:** 1.0
**Status:** Active
**Authority Level:** Authoritative (Authority Resolution)
**Effective Date:** 2026-01-24

---

## Overview

The Directive Resolver is an **authority resolution MCP** that determines what is allowed in the repository.

It operates in **READ-ONLY** mode and resolves:
- Which files are immutable
- Which directories are writable
- Which MCPs are advisory vs executory
- Whether the OS is in FROZEN or MUTABLE state

**It does NOT execute changes. It determines what is allowed.**

---

## Responsibility

**Single Domain:** Authority and permission resolution

The Directive Resolver:
- Reads `/policy` to understand governance rules
- Reads `/directives` to understand human intent
- Reads `/baseline` to understand constraints
- Reads repository metadata for current state
- Resolves conflicts using strict authority hierarchy
- Produces deterministic resolution objects

The Directive Resolver does NOT:
- Write files
- Modify memory
- Execute diffs
- Make architectural decisions
- Suggest fixes

---

## Authority Level

**Authoritative (Authority Resolution)**

The Directive Resolver operates **after Structure Guardian success** and **before Execution Gate**.

**Execution Flow:**
```
Structure Guardian (STRUCTURE_OK)
    ↓
Directive Resolver (produces RESOLUTION_STATE)
    ↓
Execution Gate (EXECUTE/ADVISE_ONLY/HALT)
```

---

## Authority Order (Strict Hierarchy)

The Directive Resolver enforces this immutable hierarchy:

```
1. Locked Policies (highest)
2. Active Directives
3. Baseline Constraints
4. Repository State
5. Conversation Context (lowest)
```

**Lower layers may NEVER override higher layers.**

---

## Output Guarantees

The Directive Resolver returns a **deterministic resolution object**:

```
RESOLUTION_STATE:
- os_state: FROZEN | MUTABLE
- writable_paths: [list of paths where writes are permitted]
- forbidden_paths: [list of paths where writes are prohibited]
- advisory_mcps: [list of MCPs operating in advisory mode]
- executory_mcps: [list of MCPs authorized to execute]
- unresolved_conflicts: YES | NO
```

---

## Resolution Logic

### OS State Resolution

**FROZEN:**
- No locked files may be modified
- Only explicitly authorized paths are writable
- All MCPs default to advisory mode
- High caution enforcement

**MUTABLE:**
- Non-locked files may be modified within MCP domains
- Standard gate controls apply
- MCPs operate in declared modes
- Normal operation

**Determination:**
- Check for FROZEN directives
- Check baseline immutability constraints
- Default to MUTABLE if no freeze signals

---

### Writable Paths Resolution

**Algorithm:**
1. Start with empty writable set
2. Add paths authorized by active directives
3. Remove paths forbidden by policies
4. Remove locked files (from `/baseline/locked-files.md`)
5. Remove paths outside MCP domain boundaries
6. Return final writable set

**Conflict Resolution:**
- If directive authorizes write to locked file → directive wins (explicit override)
- If policy forbids write to directive path → policy wins (governance supremacy)
- If no directive exists → default to forbidden

---

### Forbidden Paths Resolution

**Always Forbidden:**
- `/policy/*` (unless directive explicitly authorizes policy modification)
- Locked files (unless directive explicitly authorizes baseline migration)
- Paths outside MCP domain boundaries

**Conditionally Forbidden:**
- `/memory/*` (forbidden unless Intent Logger MCP or directive authorizes)
- `/baseline/*` (forbidden unless directive authorizes migration)
- `/directives/*` (human-exclusive, always forbidden to AI)

---

### MCP Mode Resolution

**Advisory Mode:**
- MCP can analyze and suggest
- MCP cannot execute changes
- Output is informational only

**Executory Mode:**
- MCP can execute authorized changes
- MCP operates within resolved writable paths
- Subject to Execution Gate approval

**Resolution Logic:**
- Check directive for MCP mode specification
- Check policy for MCP authority grants
- Default to ADVISORY if ambiguous

---

## Failure Mode

**If any conflict cannot be resolved deterministically:**

1. **Mark `unresolved_conflicts = YES`**
2. **Downgrade ALL MCPs to ADVISORY**
3. **Emit blocking warning**
4. **Execution Gate will HALT on unresolved conflicts**

**Examples of unresolvable conflicts:**
- Directive A authorizes write to `/policy/001`, Directive B forbids it
- Policy says FROZEN, Directive says MUTABLE
- Multiple directives with contradictory scope

---

## Dependencies

**Allowed Dependencies:**
- Filesystem read access (read-only)
- `/policy/*` (read)
- `/directives/*` (read)
- `/baseline/*` (read)
- Repository metadata (read)

**Forbidden Dependencies:**
- No write access to any file
- No memory persistence
- No external network calls
- No other MCP dependencies

---

## Integration Point

**When invoked:** After Structure Guardian validation passes

**Invocation pattern:**
```
Structure Guardian → STRUCTURE_OK
    ↓
Directive Resolver reads:
    - /policy/* (governance rules)
    - /directives/* (human intent)
    - /baseline/* (constraints)
    - Repository state
    ↓
Directive Resolver produces:
    - RESOLUTION_STATE
    ↓
Execution Gate uses resolution to approve/deny changes
```

---

## Version History

**v1.0** (2026-01-24) — Initial Directive Resolver MCP

---

## Related Documents

- **BASELINE 003** — MCP Contract
- **POLICY 001** — Structural Integrity
- **POLICY 005** — MCP Interaction Authority
- **Directive 003** — Authorize MCP System Creation
- **Structure Guardian MCP** — `/mcps/structure-guardian/`
- **Execution Gate MCP** — `/mcps/execution-gate/`

---

## Compliance

This MCP is compliant with:
- BASELINE 003 (MCP Contract)
- POLICY 001 (Structural Integrity)
- POLICY 005 (MCP Interaction Authority)

**Authority:** Authoritative (Authority Resolution)
**Immutability:** Locked under BASELINE 003
