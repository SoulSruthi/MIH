# Directive Resolver MCP Contract

**Compliant with:** BASELINE 003 — MCP Contract Specification
**Version:** 1.0
**Effective Date:** 2026-01-24
**Authorized By:** Directive 003

---

## 1. IDENTITY

**Name:** directive-resolver
**Version:** 1.0
**Domain:** Authority and Permission Resolution
**Owner:** Human-defined, AI-executable (read-only)

---

## 2. RESPONSIBILITY

### 2.1 Allowed

This MCP is responsible for:
- Reading `/policy` files to understand governance rules
- Reading `/directives` files to understand human intent
- Reading `/baseline` files to understand system constraints
- Reading repository metadata to understand current state
- Resolving authority conflicts using strict hierarchy
- Determining which files are immutable
- Determining which directories are writable
- Determining which MCPs operate in advisory vs executory mode
- Determining whether OS is in FROZEN or MUTABLE state
- Producing deterministic resolution objects

### 2.2 Forbidden

This MCP must NOT:
- Write any file
- Modify memory
- Execute diffs or changes
- Suggest fixes or modifications
- Make architectural decisions
- Override policy rules
- Bypass authority hierarchy
- Grant permissions beyond directive authorization

### 2.3 Never-Do (Absolute Prohibitions)

This MCP must NEVER:
- Write to `/policy` files
- Write to `/directives` files
- Write to `/baseline` files
- Write to `/memory` files
- Modify locked files
- Create or delete directories
- Self-authorize actions
- Resolve conflicts by guessing or assuming
- Downgrade policy authority

---

## 3. INPUTS

### 3.1 Required Inputs

**Required for resolution:**
- `/policy/*` files (governance rules)
- `/directives/*` files (human intent, may be empty)
- `/baseline/locked-files.md` (immutable file registry)
- `/baseline/structure.schema.json` (directory structure)

**Repository Context:**
- Current working directory
- File tree structure
- Repository state

### 3.2 Optional Inputs

**Optional context:**
- Conversation history (lowest authority)
- Repository metadata (git status, branch info)
- MCP mode preferences

### 3.3 Validation Rules

**Pre-execution validation:**
1. `/policy` directory must exist and contain policy files
2. `/directives` directory must exist (may be empty)
3. `/baseline/locked-files.md` must exist
4. `/baseline/structure.schema.json` must exist
5. All policy files must be readable

**Validation failure handling:**
- If required files missing → Return resolution with `unresolved_conflicts = YES`
- If files malformed → Return resolution with `unresolved_conflicts = YES`
- If authority hierarchy cannot be determined → Downgrade all MCPs to ADVISORY

---

## 4. OUTPUTS

### 4.1 Guaranteed Outputs

**Primary Output (ALWAYS returned):**

```
RESOLUTION_STATE:
- os_state: FROZEN | MUTABLE
- writable_paths: [array of absolute paths]
- forbidden_paths: [array of absolute paths]
- advisory_mcps: [array of MCP names]
- executory_mcps: [array of MCP names]
- unresolved_conflicts: YES | NO
```

**Field Definitions:**

- **os_state:** Current operational state
  - `FROZEN` — No locked files may be modified, high caution
  - `MUTABLE` — Standard operation, gate controls apply

- **writable_paths:** Explicit list of paths where writes are permitted
  - Must be deterministic
  - Must respect authority hierarchy
  - Must exclude locked files (unless directive explicitly overrides)

- **forbidden_paths:** Explicit list of paths where writes are prohibited
  - Always includes `/policy/*`
  - Always includes locked files (unless directive explicitly overrides)
  - Always includes paths outside MCP domain boundaries

- **advisory_mcps:** MCPs operating in advisory-only mode
  - Can analyze and suggest
  - Cannot execute changes

- **executory_mcps:** MCPs authorized to execute changes
  - Can make changes within writable_paths
  - Subject to Execution Gate approval

- **unresolved_conflicts:** Whether resolution was deterministic
  - `NO` — All conflicts resolved, safe to proceed
  - `YES` — Ambiguous authority, all MCPs downgraded to ADVISORY, execution blocked

### 4.2 Optional Outputs

**Additional context (if applicable):**
- Conflict details (if `unresolved_conflicts = YES`)
- Authority hierarchy applied
- Directive interpretation notes

### 4.3 Failure Modes

**Failure Type 1: Unresolvable Conflict**
- **Trigger:** Contradictory directives or policy-directive conflict
- **Output:** `unresolved_conflicts = YES`, all MCPs → ADVISORY
- **Recovery:** Human must resolve conflict by updating directive or policy
- **Escalation:** Execution Gate will HALT

**Failure Type 2: Missing Required Files**
- **Trigger:** Policy or baseline files missing
- **Output:** `unresolved_conflicts = YES`, all MCPs → ADVISORY
- **Recovery:** Human must restore missing files
- **Escalation:** Execution Gate will HALT

**Failure Type 3: Malformed Input**
- **Trigger:** Policy or directive files contain invalid syntax
- **Output:** `unresolved_conflicts = YES`, all MCPs → ADVISORY
- **Recovery:** Human must fix malformed files
- **Escalation:** Execution Gate will HALT

**Failure Type 4: Ambiguous Authority**
- **Trigger:** Cannot determine whether policy or directive has precedence
- **Output:** `unresolved_conflicts = YES`, all MCPs → ADVISORY
- **Recovery:** Human must clarify authority order
- **Escalation:** Execution Gate will HALT

---

## 5. SIDE EFFECTS

### 5.1 Explicitly Allowed Side Effects

None.

The Directive Resolver operates in **pure read-only mode** with zero side effects.

### 5.2 Forbidden Side Effects

- File creation
- File modification
- File deletion
- Directory creation
- Directory deletion
- Memory persistence
- State storage
- Cache creation

---

## 6. DEPENDENCIES

### 6.1 Allowed Dependencies

**Read-Only Access To:**
- Filesystem (read-only)
- `/policy/*` (governance rules)
- `/directives/*` (human intent)
- `/baseline/*` (system constraints)
- Repository metadata (git status, file tree)

**System Resources:**
- File read operations
- Directory traversal
- JSON/Markdown parsing

### 6.2 Forbidden Dependencies

- No write access to any MCP folder
- No modification of any file
- No invocation of other MCPs
- No external network calls
- No database connections
- No persistent state storage

### 6.3 External Dependencies

**Standard Libraries Only:**
- File I/O (standard library)
- JSON parser (standard library)
- Markdown parser (standard library)
- Path resolution utilities

**No third-party dependencies.**

---

## 7. AUTHORITY LIMITS

### 7.1 Domain Boundary Enforcement

**Authority Scope:** Authority and permission resolution (read-only)

**Cannot Assume Authority For:**
- File modification
- Policy creation or modification
- Directive creation or modification
- Memory persistence
- Execution of changes

**Violation Response:**
- If asked to modify files → Refuse with contract violation notice
- If asked to create policies → Refuse, human-exclusive authority
- If asked to execute changes → Refuse, resolution only

### 7.2 Global State Protection

**This MCP Cannot:**
- Modify `/policy` files
- Modify `/baseline` files
- Modify `/directives` files
- Modify any global configuration
- Grant permissions beyond directive authorization

**Read-Only Guarantee:** Directive Resolver has zero write capability

### 7.3 Memory Persistence Limits

**This MCP:**
- Is stateless
- Does not persist memory
- Does not cache results
- Resolves fresh on every invocation

**No hidden state, no persistence, no caching.**

### 7.4 MCP Output Override Prevention

**This MCP:**
- Does not override other MCP outputs
- Provides resolution that others consume
- Reports authority conflicts only

**Other MCPs:**
- Must respect Directive Resolver resolution
- Cannot override `unresolved_conflicts = YES`
- Cannot proceed if conflicts detected

### 7.5 Policy Decision Prohibition

**This MCP:**
- Does NOT make policy decisions
- Reads and interprets existing policy
- Applies policy rules to determine permissions

**Policy Authority:**
- Remains with `/policy` MCP
- Directive Resolver consumes policy, does not create it

### 7.6 DOE Flow Integrity

**This MCP operates within the DOE flow:**

**Lifecycle:**
```
Structure Guardian (validates integrity)
    ↓
Directive Resolver (determines permissions) ← THIS MCP
    ↓
Execution Gate (approves/denies execution)
    ↓
Execution (if approved)
```

**Cannot Bypass:** Structure Guardian or Execution Gate

---

## 8. INTERACTION MODEL

### 8.1 No Direct MCP Communication

**This MCP:**
- Does not call other MCPs
- Does not write to other MCP domains
- Does not read other MCP runtime outputs

**Interaction Pattern:**
- Invoked by orchestration after Structure Guardian success
- Reads policy, directives, baseline files
- Returns resolution state
- Terminates

### 8.2 Orchestration-Mediated Interaction

**Invocation:**
- Orchestration invokes Directive Resolver after Structure Guardian passes
- Directive Resolver reads governance files
- Directive Resolver produces RESOLUTION_STATE
- Orchestration passes resolution to Execution Gate
- No direct communication with other MCPs

### 8.3 Stateless Operation

**Lifecycle:**
```
1. Orchestration invokes Directive Resolver
2. Directive Resolver reads /policy, /directives, /baseline
3. Directive Resolver applies authority hierarchy
4. Directive Resolver resolves conflicts
5. Directive Resolver determines OS state, writable paths, MCP modes
6. Directive Resolver returns RESOLUTION_STATE
7. Directive Resolver terminates (no state retained)
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
- All state is transient (exists only during resolution)
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
- Directive Resolver modifying its own contract
- Directive Resolver invoking itself recursively
- Directive Resolver changing its own authority level

### 11.2 Input Invention

**Prohibited:**
- Guessing missing directives
- Creating default policies
- Assuming authority when ambiguous

**Required Behavior:**
- If directive missing → Default to forbidden
- If policy unclear → Mark `unresolved_conflicts = YES`
- No assumptions, no defaults beyond documented rules

### 11.3 Intent Assumption

**Prohibited:**
- Inferring what directives "should say"
- Filling gaps in directive specifications
- Guessing human intent from conversation

**Required Behavior:**
- Read explicit directive content only
- Apply strict authority hierarchy
- Mark conflicts when authority unclear

### 11.4 Unauthorized Memory Persistence

**Prohibited:**
- Storing resolution results
- Caching authority determinations
- Creating log files
- Persisting state

**Required Behavior:**
- Resolve fresh every time
- Return result
- Terminate cleanly
- No persistence

### 11.5 Architectural Decision-Making

**Prohibited:**
- Deciding what permissions "should be"
- Choosing resolution strategies
- Redefining authority hierarchy

**Required Behavior:**
- Follow documented authority order
- Apply explicit rules only
- No architectural decisions

---

## 12. ENFORCEMENT

### 12.1 Violation Detection

**If an action violates this contract:**

1. **STOP execution immediately**
2. **Report the violation**
3. **Report the context**
4. **Request compliant alternative**

### 12.2 Violation Severity

**Critical Violations (Immediate Halt):**
- Attempting file write
- Modifying policy or directive files
- Granting unauthorized permissions
- Bypassing authority hierarchy

**Major Violations (Halt + Remediation Required):**
- Operating outside read-only scope
- Persisting state
- Making policy decisions
- Assuming authority

**Minor Violations (Warning + Correction):**
- Incomplete resolution reporting
- Missing conflict details
- Unclear resolution state

### 12.3 Remediation Process

**For Critical/Major Violations:**
1. **HALT**
2. **Report** violation
3. **Rollback** unauthorized changes (if any)
4. **Request Authorization**
5. **Await Approval**

---

## 13. IMMUTABILITY

### 13.1 Constitutional Immutability

**This contract cannot be altered by:**
- Conversation
- Other MCPs
- Orchestration logic
- Execution processes

### 13.2 Modification Requirements

**To modify this contract:**

1. **Create Directive** authorizing contract change
2. **Impact Assessment** on authority resolution system
3. **Security Review**
4. **Version Increment** (v2.0)
5. **Archive v1.0**
6. **Update `/memory`**

### 13.3 No Shortcuts

**Prohibited bypass attempts:**
- "This is a special case"
- "Just for this resolution"
- "We'll fix the contract later"
- "The user authorized it" (conversation ≠ directive)

---

## 14. INTEGRATION WITH DOE FRAMEWORK

### 14.1 MCP Role in DOE Gates

**Directive Resolver operates between Structure Guardian and Execution Gate:**

```
Structure Guardian → STRUCTURE_OK
    ↓
Directive Resolver → RESOLUTION_STATE
    ↓
Execution Gate → EXECUTE/ADVISE_ONLY/HALT
    ↓
Execution (if approved)
```

### 14.2 Authority Resolution Phase

**Directive Resolver ensures:**
- Authority hierarchy is respected
- Permissions are deterministic
- Conflicts are detected and reported
- MCP modes are clearly defined

### 14.3 Policy Enforcement During Resolution

**Directive Resolver enforces:**
- POLICY 001 (Structural Integrity) via forbidden paths
- POLICY 005 (MCP Interaction Authority) via MCP mode resolution
- Authority order (policy > memory > directive > conversation)

---

## 15. VERSION HISTORY

**v1.0** (2026-01-24) — Initial Directive Resolver MCP Contract

---

## 16. RELATED DOCUMENTS

- **BASELINE 003** — MCP Contract Specification
- **POLICY 001** — Structural Integrity
- **POLICY 005** — MCP Interaction Authority
- **Directive 003** — Authorize MCP System Creation
- **Structure Guardian MCP** — `/mcps/structure-guardian/`
- **Execution Gate MCP** — `/mcps/execution-gate/`

---

## 17. ACKNOWLEDGMENT PROTOCOL

**When this contract is installed, AI must respond:**

> **"DIRECTIVE RESOLVER MCP INSTALLED — CONTRACT v1.0 ACTIVE"**

**From this point forward:**
- Directive Resolver must be invoked after Structure Guardian success
- `unresolved_conflicts = YES` blocks execution
- Authority hierarchy is strictly enforced
- Permission resolution is deterministic

---

## 18. COMPLIANCE STATEMENT

**This MCP contract is compliant with:**
- BASELINE 003 (MCP Contract Specification)
- POLICY 001 (Structural Integrity)
- POLICY 005 (MCP Interaction Authority)
- Directive 003 (Authorization)

**Authority Level:** Authoritative (Authority Resolution)
**Immutability:** Locked under BASELINE 003
**Enforcement:** Mandatory authority resolution phase

**END OF DIRECTIVE RESOLVER MCP CONTRACT**
