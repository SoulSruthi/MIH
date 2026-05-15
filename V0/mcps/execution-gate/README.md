# Execution Gate MCP

**MCP Name:** execution-gate
**Version:** 1.0
**Status:** Active
**Authority Level:** Executory Control (Final Verdict)
**Effective Date:** 2026-01-24

---

## Overview

The Execution Gate is a **final approval MCP** that decides whether proposed actions may EXECUTE, must remain ADVISORY, or must HALT.

It operates in **READ-ONLY** mode (reads signals, returns verdict) and makes **binary enforcement decisions**.

**It does NOT generate changes. It approves or denies them.**

---

## Responsibility

**Single Domain:** Execution approval/denial

The Execution Gate:
- Receives input signals from upstream MCPs
- Evaluates proposed changes against policy rules
- Determines whether execution is safe
- Returns one of three verdicts: EXECUTE, ADVISE_ONLY, or HALT
- Enforces safety over helpfulness

The Execution Gate does NOT:
- Generate diffs or changes
- Suggest modifications
- Execute approved changes (delegates to execution layer)
- Override policy rules
- Make exceptions

---

## Authority Level

**Executory Control (Final Verdict)**

The Execution Gate operates **after all other MCPs** and **before any execution**.

**Execution Flow:**
```
Structure Guardian → STRUCTURE_OK
    ↓
Directive Resolver → RESOLUTION_STATE
    ↓
Proposed Changes → Diff Generation
    ↓
Execution Gate → EXECUTE | ADVISE_ONLY | HALT
    ↓
[EXECUTE] → Execution Layer
[ADVISE_ONLY] → Present suggestions to user, no execution
[HALT] → Stop all operations, report violation
```

**Verdict is final. No override mechanism exists.**

---

## Input Signals

The Execution Gate receives:

1. **Structure Guardian Status**
   - `STRUCTURE_OK` or `STRUCTURE_FAIL`

2. **Directive Resolver Resolution**
   - `RESOLUTION_STATE` object
   - `os_state`, `writable_paths`, `forbidden_paths`, `unresolved_conflicts`

3. **Proposed Changes**
   - Diff preview
   - Target file paths
   - Change type (create, modify, delete)

4. **MCP Requesting Execution**
   - Which MCP wants to execute changes
   - MCP's declared authority level

5. **Repository Context**
   - Current state
   - Git status (if applicable)

---

## Decision Logic

The Execution Gate applies rules in strict priority order:

### Priority 1: HALT Conditions (Non-Negotiable)

**Immediate HALT if ANY of these are true:**

1. **Structure Guardian Failed**
   - If Structure Guardian returned `STRUCTURE_FAIL` → HALT
   - Reason: Cannot execute in compromised environment

2. **Unresolved Conflicts Exist**
   - If Directive Resolver returned `unresolved_conflicts = YES` → HALT
   - Reason: Ambiguous authority, cannot determine safety

3. **Unauthorized Path Touched**
   - If any proposed change touches a path NOT in `writable_paths` → HALT
   - If any proposed change touches a path in `forbidden_paths` → HALT
   - Reason: Violates directive authorization

4. **Policy Drift Detected**
   - If proposed changes would modify `/policy` files without explicit directive → HALT
   - Reason: Policy modification requires human-exclusive authority

5. **Memory Corruption Risk**
   - If proposed changes would modify `/memory` without Intent Logger authorization → HALT
   - Reason: Memory integrity protection

6. **MCP Exceeds Declared Scope**
   - If requesting MCP is not in `executory_mcps` list → HALT (or downgrade to ADVISE_ONLY)
   - Reason: MCP operating outside authorized scope

7. **OS is FROZEN**
   - If `os_state = FROZEN` AND no explicit directive override → HALT
   - Reason: FROZEN state blocks all execution by default

---

### Priority 2: ADVISE_ONLY Conditions

**Downgrade to ADVISE_ONLY if ANY of these are true:**

1. **MCP in Advisory Mode**
   - If requesting MCP is in `advisory_mcps` list → ADVISE_ONLY
   - Reason: MCP not authorized for execution

2. **Read-Only Operation Requested**
   - If proposed changes are analysis-only (no file writes) → ADVISE_ONLY (or EXECUTE if harmless)
   - Reason: No execution risk

3. **User Confirmation Required**
   - If change is significant but safe, may request user confirmation → ADVISE_ONLY (present suggestion)
   - Reason: Human oversight for important decisions

---

### Priority 3: EXECUTE Conditions

**Allow EXECUTE if ALL of these are true:**

1. ✅ Structure Guardian returned `STRUCTURE_OK`
2. ✅ Directive Resolver returned `unresolved_conflicts = NO`
3. ✅ OS state is `MUTABLE` (or explicit directive override in FROZEN)
4. ✅ All proposed changes are within `writable_paths`
5. ✅ No proposed changes touch `forbidden_paths`
6. ✅ Requesting MCP is in `executory_mcps` list
7. ✅ No policy drift detected
8. ✅ No memory corruption risk
9. ✅ No HALT conditions triggered

**If all checks pass → EXECUTE**

---

## Output Guarantees

The Execution Gate returns **ONLY one of three verdicts**:

```
EXECUTE
```
OR
```
ADVISE_ONLY
```
OR
```
HALT
```

**With optional context:**
```
HALT
Reason: [specific violation]
Violated Rule: [policy or contract section]
Remediation: [what must be done to unblock]
```

---

## Examples

### Example 1: Safe Execution

**Input:**
- Structure Guardian: `STRUCTURE_OK`
- Directive Resolver: `unresolved_conflicts = NO`, `os_state = MUTABLE`, `/execution/feature-x/` in `writable_paths`
- Proposed changes: Create `/execution/feature-x/handler.ts`
- Requesting MCP: `execution` (in `executory_mcps`)

**Verdict:**
```
EXECUTE
```

---

### Example 2: Advisory Mode (MCP Not Authorized)

**Input:**
- Structure Guardian: `STRUCTURE_OK`
- Directive Resolver: `unresolved_conflicts = NO`, `os_state = MUTABLE`
- Proposed changes: Modify `/execution/feature-y/util.ts`
- Requesting MCP: `analysis-tool` (in `advisory_mcps`, not `executory_mcps`)

**Verdict:**
```
ADVISE_ONLY
Reason: Requesting MCP is in advisory mode, not authorized for execution
```

---

### Example 3: HALT (Unauthorized Path)

**Input:**
- Structure Guardian: `STRUCTURE_OK`
- Directive Resolver: `unresolved_conflicts = NO`, `os_state = MUTABLE`, `/policy/` in `forbidden_paths`
- Proposed changes: Modify `/policy/001-structural-integrity.md`
- Requesting MCP: `execution`

**Verdict:**
```
HALT
Reason: Proposed change touches forbidden path (/policy/001-structural-integrity.md)
Violated Rule: POLICY 001 — Structural Integrity (human-exclusive policy authorship)
Remediation: Create directive explicitly authorizing policy modification OR modify non-policy files only
```

---

### Example 4: HALT (Structure Guardian Failed)

**Input:**
- Structure Guardian: `STRUCTURE_FAIL` (hash mismatch detected)
- Directive Resolver: Not invoked (halted by Structure Guardian)
- Proposed changes: Any

**Verdict:**
```
HALT
Reason: Structure Guardian validation failed, cannot execute in compromised environment
Violated Rule: BASELINE 003 — MCP Contract (structural integrity prerequisite)
Remediation: Restore file integrity, resolve hash mismatches, re-run Structure Guardian
```

---

### Example 5: HALT (Unresolved Conflicts)

**Input:**
- Structure Guardian: `STRUCTURE_OK`
- Directive Resolver: `unresolved_conflicts = YES` (contradictory directives detected)
- Proposed changes: Any

**Verdict:**
```
HALT
Reason: Unresolved conflicts in authority resolution
Violated Rule: Authority hierarchy ambiguity (Directive Resolver)
Remediation: Resolve contradictory directives, clarify authority order, re-run Directive Resolver
```

---

### Example 6: HALT (FROZEN State, No Override)

**Input:**
- Structure Guardian: `STRUCTURE_OK`
- Directive Resolver: `unresolved_conflicts = NO`, `os_state = FROZEN`, `writable_paths = []`
- Proposed changes: Create `/execution/feature-z/service.ts`
- Requesting MCP: `execution`

**Verdict:**
```
HALT
Reason: OS is in FROZEN state, no execution permitted without explicit directive override
Violated Rule: FROZEN state enforcement
Remediation: Create directive explicitly authorizing execution in FROZEN state OR wait for MUTABLE state
```

---

## Dependencies

**Allowed Dependencies:**
- Reads Structure Guardian output
- Reads Directive Resolver output
- Reads proposed change diffs
- Reads MCP execution requests
- Reads repository state

**Forbidden Dependencies:**
- No write access to any file
- No modification of MCPs
- No policy creation
- No memory persistence

---

## Integration Point

**When invoked:** After Directive Resolver resolution, before any execution

**Invocation pattern:**
```
Structure Guardian → STRUCTURE_OK
    ↓
Directive Resolver → RESOLUTION_STATE
    ↓
Diff Generation → Proposed Changes
    ↓
Execution Gate evaluates:
    - All input signals
    - All proposed changes
    - All safety rules
    ↓
Returns: EXECUTE | ADVISE_ONLY | HALT
    ↓
[EXECUTE] → Execution Layer executes approved changes
[ADVISE_ONLY] → Present suggestions to user
[HALT] → Stop all operations
```

---

## Non-Negotiable Rules

### Rule 1: Safety Beats Helpfulness

**Silently fixing things is forbidden.**

- If unsafe → HALT
- If ambiguous → HALT or ADVISE_ONLY
- If unauthorized → HALT
- No "helpful" workarounds

---

### Rule 2: No Override Mechanism

**Verdict is final.**

- No conversation override
- No "just this once" exceptions
- No temporary bypasses

---

### Rule 3: HALT Conditions are Absolute

**If ANY HALT condition triggered → HALT**

- No partial execution
- No "safe subset" execution
- All or nothing

---

## Version History

**v1.0** (2026-01-24) — Initial Execution Gate MCP

---

## Related Documents

- **BASELINE 003** — MCP Contract
- **POLICY 001** — Structural Integrity
- **POLICY 002** — Execution Gating
- **POLICY 005** — MCP Interaction Authority
- **Directive 003** — Authorize MCP System Creation
- **Structure Guardian MCP** — `/mcps/structure-guardian/`
- **Directive Resolver MCP** — `/mcps/directive-resolver/`

---

## Compliance

This MCP is compliant with:
- BASELINE 003 (MCP Contract)
- POLICY 001 (Structural Integrity)
- POLICY 002 (Execution Gating)
- POLICY 005 (MCP Interaction Authority)

**Authority:** Executory Control (Final Verdict)
**Immutability:** Locked under BASELINE 003
