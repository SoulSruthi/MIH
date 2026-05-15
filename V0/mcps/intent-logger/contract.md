# Intent Logger MCP Contract

**Compliant with:** BASELINE 003 — MCP Contract Specification
**Version:** 1.0
**Effective Date:** 2026-01-24
**Authorized By:** Directive 003

---

## 1. IDENTITY

**Name:** intent-logger
**Version:** 1.0
**Domain:** Memory Persistence (Decisions and Intent)
**Owner:** Human-defined, AI-executable (write-authorized to `/memory`)

**Designated Memory MCP:** YES (per BASELINE 003, Section 5.2)

---

## 2. RESPONSIBILITY

### 2.1 Allowed
- Read conversation intent
- Read MCP decisions
- Append to `/memory/decisions.md`
- Append to `/memory/known-tradeoffs.md`
- Record WHY decisions were made
- Preserve institutional memory
- Operate opportunistically (never block execution)

### 2.2 Forbidden
- Edit existing memory entries
- Delete memory entries
- Write outside `/memory` directory
- Record implementation details (only intent/reasoning)
- Block execution on write failure
- Modify policies or directives

### 2.3 Never-Do
- Overwrite existing memory
- Delete memory files
- Write to `/policy`, `/baseline`, `/directives`
- Record HOW (only WHY)
- Block execution if memory is locked

---

## 3. INPUTS

### 3.1 Required Inputs
- Decision context (what was decided)
- Decision reasoning (why it was decided)
- Decision source (human or MCP name)

### 3.2 Optional Inputs
- Timestamp (auto-generated if not provided)
- Additional context

### 3.3 Validation Rules
- All required fields must be present
- If memory is locked, skip write and emit warning (do not block)

---

## 4. OUTPUTS

### 4.1 Guaranteed Outputs
- Memory entry written (if memory is writable)
- OR warning emitted (if memory is locked)
- Execution never blocked

### 4.2 Failure Modes
- **Memory locked:** Skip write, emit warning, continue
- **Memory file missing:** Create file (if authorized) OR emit warning
- **Write permission denied:** Emit warning, continue

---

## 5. SIDE EFFECTS

### 5.1 Explicitly Allowed Side Effects
- Append to `/memory/decisions.md`
- Append to `/memory/known-tradeoffs.md`
- Create memory files if missing (if authorized)

### 5.2 Forbidden Side Effects
- Edit existing memory entries
- Delete memory entries
- Write outside `/memory`
- Modify any other files

---

## 6. DEPENDENCIES

### 6.1 Allowed Dependencies
- Read conversation context
- Read MCP decision outputs
- Write to `/memory/decisions.md`
- Write to `/memory/known-tradeoffs.md`
- Filesystem I/O (append operations)

### 6.2 Forbidden Dependencies
- No writes outside `/memory`
- No modification of policies, directives, or baselines
- No external network calls

---

## 7-18. [STANDARD BASELINE 003 SECTIONS]

All standard MCP contract sections apply as defined in BASELINE 003.

**Key Points:**
- **Designated Memory MCP** (per BASELINE 003, Section 5.2)
- Write authority limited to `/memory` only
- Append-only operations
- Opportunistic persistence (never blocks execution)
- Records intent, not implementation
- Stateless (does not cache, re-reads memory on each invocation)

---

## MEMORY MCP DESIGNATION

Per BASELINE 003, Section 5.2:

> **Memory MCP Designation**
>
> **Rule:** Only MCPs explicitly designated as "memory MCPs" may persist state.
>
> **Current Memory MCPs:**
> - `/memory` — Persistent state and decisions

**Intent Logger is the designated memory MCP for:**
- Decision persistence
- Trade-off documentation
- Intent preservation
- Reasoning capture

**All other MCPs are stateless and cannot persist memory.**

---

## COMPLIANCE STATEMENT

**This MCP contract is compliant with:**
- BASELINE 003 (MCP Contract Specification)
- POLICY 004 (Memory & Decision Persistence)
- POLICY 005 (MCP Interaction Authority)
- Directive 003 (Authorization)

**Authority Level:** Memory Write (Designated Memory MCP)
**Immutability:** Locked under BASELINE 003

**END OF INTENT LOGGER MCP CONTRACT**
