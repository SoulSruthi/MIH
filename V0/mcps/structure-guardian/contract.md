# Structure Guardian MCP Contract

**Compliant with:** BASELINE 003 — MCP Contract Specification
**Version:** 1.0
**Effective Date:** 2026-01-24
**Authorized By:** Directive 003

---

## 1. IDENTITY

**Name:** structure-guardian
**Version:** 1.0
**Domain:** Filesystem Structural Validation
**Owner:** Human-defined, AI-executable (read-only)

---

## 2. RESPONSIBILITY

### 2.1 Allowed

This MCP is responsible for:
- Reading filesystem directory structure
- Validating directory structure against declared schema
- Reading locked file paths from baseline
- Computing and comparing SHA-256 hashes of locked files
- Detecting structural drift or schema violations
- Reporting validation status with exact violation details

### 2.2 Forbidden

This MCP must NOT:
- Modify any file on the filesystem
- Create or delete directories
- Suggest fixes or remediation steps
- Attempt automatic repairs
- Proceed with partial validation
- Grant execution authority to other MCPs
- Override policy decisions

### 2.3 Never-Do (Absolute Prohibitions)

This MCP must NEVER:
- Write to any file or directory
- Modify `/policy` files
- Modify `/baseline` files
- Grant execution permissions
- Bypass DOE gates
- Self-authorize actions
- Create ambiguous output (must be STRUCTURE_OK or STRUCTURE_FAIL)

---

## 3. INPUTS

### 3.1 Required Inputs

**No runtime inputs required.**

The Structure Guardian operates autonomously on invocation, reading from:
- `/baseline/structure.schema.json` (directory structure definition)
- `/baseline/locked-files.md` (list of immutable files)
- `/baseline/hashes.json` (SHA-256 hash registry)

### 3.2 Optional Inputs

None.

### 3.3 Validation Rules

**Pre-execution validation:**
1. `/baseline/structure.schema.json` must exist and be valid JSON
2. `/baseline/locked-files.md` must exist
3. `/baseline/hashes.json` must exist and be valid JSON
4. Filesystem read permissions must be available

**Validation failure handling:**
- If required files missing → Return `STRUCTURE_FAIL` with missing file list
- If files malformed → Return `STRUCTURE_FAIL` with parse error details
- If filesystem unreadable → Return `STRUCTURE_FAIL` with permission error

---

## 4. OUTPUTS

### 4.1 Guaranteed Outputs

**Primary Output (ALWAYS returned):**

One of:
- `STRUCTURE_OK` — All validations passed
- `STRUCTURE_FAIL` — One or more violations detected

**Validation Result Format:**
```
STRUCTURE_OK
```
OR
```
STRUCTURE_FAIL

Violations:
- [violation type]: [exact file path or detail]
- [violation type]: [exact file path or detail]
...

Invariant Broken: [which rule/constraint was violated]
```

### 4.2 Optional Outputs

None. Output is deterministic and binary.

### 4.3 Failure Modes

**Failure Type 1: Schema Violation**
- **Trigger:** Required directory missing or forbidden directory present
- **Output:** `STRUCTURE_FAIL` with directory path and expected state
- **Recovery:** Human must restore correct structure
- **Escalation:** Global MCP HALT

**Failure Type 2: Locked File Missing**
- **Trigger:** File listed in `locked-files.md` does not exist
- **Output:** `STRUCTURE_FAIL` with missing file path
- **Recovery:** Human must restore file or update baseline
- **Escalation:** Global MCP HALT

**Failure Type 3: Hash Mismatch**
- **Trigger:** Locked file exists but hash does not match `hashes.json`
- **Output:** `STRUCTURE_FAIL` with file path, expected hash, actual hash
- **Recovery:** Human must restore file or authorize baseline update
- **Escalation:** Global MCP HALT

**Failure Type 4: Baseline File Missing**
- **Trigger:** Required baseline validation files missing
- **Output:** `STRUCTURE_FAIL` with missing baseline file path
- **Recovery:** Human must create baseline files or restore from backup
- **Escalation:** Global MCP HALT

**Failure Type 5: Incomplete Validation**
- **Trigger:** Validation process interrupted or unable to complete all checks
- **Output:** `STRUCTURE_FAIL` with incomplete validation notice
- **Recovery:** Human must investigate and resolve
- **Escalation:** Global MCP HALT

---

## 5. SIDE EFFECTS

### 5.1 Explicitly Allowed Side Effects

None.

The Structure Guardian operates in **pure read-only mode** with zero side effects.

### 5.2 Forbidden Side Effects

- File creation
- File modification
- File deletion
- Directory creation
- Directory deletion
- Cache creation
- Log file creation (logging handled externally)
- Memory persistence
- State storage

---

## 6. DEPENDENCIES

### 6.1 Allowed Dependencies

**Read-Only Access To:**
- Filesystem (read-only)
- `/baseline/structure.schema.json`
- `/baseline/locked-files.md`
- `/baseline/hashes.json`
- `/policy/*` (for reference)
- `/directives/*` (for reference)

**System Resources:**
- SHA-256 hashing capability
- JSON parsing capability
- Markdown parsing capability
- Filesystem traversal capability

### 6.2 Forbidden Dependencies

- No write access to any MCP folder
- No modification of any file
- No invocation of other MCPs
- No external network calls
- No database connections
- No persistent state storage

### 6.3 External Dependencies

**Standard Libraries Only:**
- SHA-256 hash function (standard cryptographic library)
- JSON parser (standard library)
- Filesystem API (standard library)

**No third-party dependencies.**

---

## 7. AUTHORITY LIMITS

### 7.1 Domain Boundary Enforcement

**Authority Scope:** Read-only filesystem validation

**Cannot Assume Authority For:**
- File modification
- Directory creation/deletion
- Policy enforcement (reports only)
- Execution gating (reports only)
- Other MCP operations

**Violation Response:**
- If Structure Guardian is asked to modify files → Refuse with contract violation notice
- If Structure Guardian is asked to fix violations → Refuse, report only

### 7.2 Global State Protection

**This MCP Cannot:**
- Modify `/policy` files
- Modify `/baseline` files
- Modify any global configuration
- Grant permissions to other MCPs

**Read-Only Guarantee:** Structure Guardian has zero write capability

### 7.3 Memory Persistence Limits

**This MCP:**
- Is stateless
- Does not persist memory
- Does not cache results
- Validates fresh on every invocation

**No hidden state, no persistence, no caching.**

### 7.4 MCP Output Override Prevention

**This MCP:**
- Does not override other MCP outputs
- Operates independently
- Reports violations only
- Triggers global HALT on failure

**Other MCPs:**
- Cannot override Structure Guardian output
- Must respect `STRUCTURE_FAIL` status
- Cannot proceed if Structure Guardian fails

### 7.5 Policy Decision Prohibition

**This MCP:**
- Does NOT make policy decisions
- Does NOT interpret policy
- Reads and enforces declared structural rules only

**Policy Authority:**
- Remains with `/policy` MCP
- Structure Guardian consumes policy, does not create it

### 7.6 DOE Flow Integrity

**This MCP operates BEFORE the DOE flow begins.**

**Lifecycle:**
```
User Request
    ↓
Structure Guardian Validation
    ↓
[STRUCTURE_OK] → Proceed to DOE Gates
[STRUCTURE_FAIL] → HALT (DOE never starts)
```

**Cannot Bypass:** DOE gates (does not participate in DOE)

---

## 8. INTERACTION MODEL

### 8.1 No Direct MCP Communication

**This MCP:**
- Does not call other MCPs
- Does not write to other MCP domains
- Does not read other MCP runtime outputs

**Interaction Pattern:**
- Invoked by orchestration
- Reads baseline files
- Returns validation status
- Terminates

### 8.2 Orchestration-Mediated Interaction

**Invocation:**
- Orchestration invokes Structure Guardian before any other MCP
- Structure Guardian reads baseline validation files
- Structure Guardian returns `STRUCTURE_OK` or `STRUCTURE_FAIL`
- Orchestration proceeds or halts based on result

**No direct communication with other MCPs.**

### 8.3 Stateless Operation

**Lifecycle:**
```
1. Orchestration invokes Structure Guardian
2. Structure Guardian reads baseline files
3. Structure Guardian validates filesystem
4. Structure Guardian computes hashes
5. Structure Guardian compares against baseline
6. Structure Guardian returns validation status
7. Structure Guardian terminates (no state retained)
```

**No persistent sessions, no background processes.**

---

## 9. STATE & MEMORY

### 9.1 Stateless by Default

**This MCP is completely stateless.**

- No hidden memory
- No implicit persistence
- No session state
- Each invocation is independent

### 9.2 Memory MCP Designation

**This MCP is NOT a memory MCP.**

- Cannot persist state
- Cannot store results
- Cannot cache outputs

### 9.3 No Hidden State

**Enforcement:**
- All state is transient (exists only during validation)
- No configuration files created
- No cache directories
- No unreported side effects

---

## 10. LIFECYCLE ENFORCEMENT

### 10.1 MCP State Transitions

**Current State:** Active

**Lifecycle Path:**
```
Defined → Installed → Active
```

**This MCP:**
- Was defined via contract (this document)
- Will be installed via Directive 003 authorization
- Will be marked Active upon successful installation

### 10.2 State Transition Control

**Transition Authority:**

| Transition | Authorized By |
|------------|---------------|
| Defined → Installed | Human + Directive 003 + BASELINE 003 compliance |
| Installed → Active | System initialization + validation |
| Active → Deprecated | Future directive (not currently planned) |

**This MCP Cannot:**
- Self-promote to Active
- Self-deprecate
- Skip states

### 10.3 Lifecycle Documentation

**This transition documented in:**
- This contract (Defined state)
- `/memory` (upon installation, Installed state)
- `/memory` (upon activation, Active state)

---

## 11. FORBIDDEN ACTIONS

### 11.1 Self-Invocation or Self-Modification

**Prohibited:**
- Structure Guardian modifying its own contract
- Structure Guardian invoking itself recursively
- Structure Guardian changing its own authority level

**Enforcement:**
- Contract is immutable during execution
- Modification requires new directive + version bump
- No recursive calls allowed

### 11.2 Input Invention

**Prohibited:**
- Guessing missing baseline files
- Creating default schemas
- Assuming validation rules

**Required Behavior:**
- If baseline file missing → Return `STRUCTURE_FAIL`
- If schema malformed → Return `STRUCTURE_FAIL`
- No assumptions, no defaults, no guessing

### 11.3 Intent Assumption

**Prohibited:**
- Inferring what structure "should be"
- Suggesting fixes
- Attempting repairs

**Required Behavior:**
- Validate against declared schema only
- Report exact violations
- No interpretation beyond declared rules

### 11.4 Unauthorized Memory Persistence

**Prohibited:**
- Storing validation results
- Caching hash computations
- Creating log files
- Persisting state

**Required Behavior:**
- Validate fresh every time
- Return result
- Terminate cleanly
- No persistence

### 11.5 Architectural Decision-Making

**Prohibited:**
- Deciding what structure is "correct"
- Choosing validation strategies
- Redefining baseline schema

**Required Behavior:**
- Follow baseline schema exactly
- Use declared validation rules
- No architectural decisions

---

## 12. ENFORCEMENT

### 12.1 Violation Detection

**If an action violates this contract:**

1. **STOP execution immediately**
2. **Report the violation** — State which contract section was violated
3. **Report the context** — What was attempted, why it failed
4. **Request compliant alternative** — Ask for proper authorization

**Example:**
```
BASELINE 003 CONTRACT VIOLATION DETECTED

MCP: structure-guardian
Rule Violated: Section 2.2 — Forbidden Actions
Attempted Action: Modify /baseline/structure.schema.json
Reason: Structure Guardian attempted to "fix" schema error
Status: HALTED

Required Action:
- Structure Guardian must operate in read-only mode
- Human must manually fix schema
- Re-invoke Structure Guardian after fix
```

### 12.2 Violation Severity

**Critical Violations (Immediate Halt):**
- Attempting file write
- Modifying baseline files
- Granting execution authority
- Bypassing validation checks

**Major Violations (Halt + Remediation Required):**
- Operating outside read-only scope
- Persisting state
- Making architectural decisions
- Suggesting fixes instead of reporting

**Minor Violations (Warning + Correction):**
- Incomplete validation reporting
- Missing violation details
- Unclear failure modes

### 12.3 Remediation Process

**For Critical/Major Violations:**
1. **HALT** — Stop all operations immediately
2. **Report** — Document violation in output
3. **Rollback** — Undo any unauthorized changes (if possible)
4. **Request Authorization** — Escalate to human
5. **Await Approval** — Do not proceed

**For Minor Violations:**
1. **Document** — Note the issue
2. **Propose Fix** — Suggest correction to output format
3. **Correct** — Implement improved reporting

---

## 13. IMMUTABILITY

### 13.1 Constitutional Immutability

**This contract cannot be altered by:**
- Conversation
- Other MCPs
- Orchestration logic
- Execution processes

**Immutability Means:**
- No interpretation drift
- No temporary exceptions
- No implied permissions
- No bypasses

### 13.2 Modification Requirements

**To modify this contract:**

1. **Create Directive** — New directive authorizing contract change
2. **Impact Assessment** — Analyze effects on structural validation
3. **Security Review** — Assess integrity implications
4. **Version Increment** — Create contract v2.0
5. **Archive v1.0** — Preserve this version in `/baseline`
6. **Update `/memory`** — Document transition

### 13.3 No Shortcuts

**Prohibited Bypass Attempts:**
- "This is a special case"
- "Just for this validation"
- "We'll fix the contract later"
- "The user authorized it" (conversation ≠ directive)

**All changes require full process. No exceptions.**

---

## 14. INTEGRATION WITH DOE FRAMEWORK

### 14.1 MCP Role in DOE Gates

**Structure Guardian operates BEFORE DOE gates.**

**Execution Flow:**
```
User Request
    ↓
Structure Guardian Validation
    ↓
[STRUCTURE_OK] → GATE 1 (Directive)
[STRUCTURE_FAIL] → HALT (no gates entered)
```

### 14.2 Pre-Gate Validation

**Structure Guardian ensures:**
- Repository structure is intact before any work begins
- Baseline files are uncorrupted
- Locked files are unmodified
- No structural drift has occurred

**If validation fails:**
- DOE gates never start
- No directive processing
- No orchestration
- No execution

### 14.3 Policy Enforcement at Pre-Gate

**Structure Guardian enforces:**
- POLICY 001 (Structural Integrity) via schema validation
- BASELINE 003 (MCP Contract) via read-only operation
- Filesystem immutability via hash checking

---

## 15. VERSION HISTORY

**v1.0** (2026-01-24) — Initial Structure Guardian MCP Contract

---

## 16. RELATED DOCUMENTS

- **BASELINE 003** — MCP Contract Specification
- **POLICY 001** — Structural Integrity
- **POLICY 005** — MCP Interaction Authority
- **Directive 003** — Authorize MCP System Creation
- **CLAUDE.md** — Vibe Coding OS Instructions

---

## 17. ACKNOWLEDGMENT PROTOCOL

**When this contract is installed, AI must respond:**

> **"STRUCTURE GUARDIAN MCP INSTALLED — CONTRACT v1.0 ACTIVE"**

**From this point forward:**
- Structure Guardian must be invoked before any MCP operation
- `STRUCTURE_FAIL` halts all operations
- No override mechanism exists
- Structural integrity is non-negotiable

---

## 18. COMPLIANCE STATEMENT

**This MCP contract is compliant with:**
- BASELINE 003 (MCP Contract Specification)
- POLICY 001 (Structural Integrity)
- POLICY 005 (MCP Interaction Authority)
- Directive 003 (Authorization)

**Authority Level:** Constitutional
**Immutability:** Locked under BASELINE 003
**Enforcement:** Mandatory pre-execution validation

**END OF STRUCTURE GUARDIAN MCP CONTRACT**
