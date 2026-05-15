# Intent Logger MCP

**MCP Name:** intent-logger
**Version:** 1.0
**Status:** Active
**Authority Level:** Memory Write (Designated Memory MCP)
**Effective Date:** 2026-01-24

---

## Overview

The Intent Logger is a **memory persistence MCP** that records WHY decisions were made — never HOW they were implemented.

It is the **only MCP authorized to write to `/memory`** (designated memory MCP per BASELINE 003).

**It preserves institutional memory.**

---

## Responsibility

**Single Domain:** Decision and intent persistence

The Intent Logger:
- Reads conversation intent
- Reads MCP decisions
- Records decisions, trade-offs, and reasoning
- Appends to memory files (never edits existing entries)
- Preserves "why" context for future reference
- Never blocks execution (advisory/opportunistic)

The Intent Logger does NOT:
- Edit existing memory entries
- Delete memory
- Write outside `/memory` directory
- Record implementation details (only intent/reasoning)
- Block execution on write failure

---

## Authority Level

**Memory Write (Designated Memory MCP)**

Per BASELINE 003, Section 5.2:
> Only MCPs explicitly designated as "memory MCPs" may persist state.

The Intent Logger is the designated memory MCP for:
- Decision recording
- Trade-off documentation
- Intent preservation
- Reasoning capture

**It operates asynchronously and never blocks execution.**

---

## Allowed Write Targets

The Intent Logger may ONLY write to:

1. **`/memory/decisions.md`**
   - Decision log
   - Each entry: timestamp, context, decision, reasoning, source

2. **`/memory/known-tradeoffs.md`**
   - Trade-off documentation
   - Each entry: timestamp, context, trade-off description, reasoning

**All other paths are FORBIDDEN.**

---

## Write Rules

Each memory entry MUST include:

```markdown
## [Entry Title]
**Timestamp:** YYYY-MM-DDTHH:MM:SSZ
**Context:** [What triggered this decision/trade-off]
**Decision/Trade-Off:** [What was decided/accepted]
**Reasoning:** [Why this was chosen]
**Source:** [Human | MCP Name]
```

**Entries must be append-only.**
- Never edit existing entries
- Never delete entries
- Only append new entries to end of file

---

## Failure Mode

**If memory is locked or unwritable:**

1. **Skip write** (do not block execution)
2. **Emit warning** (log to console/output)
3. **Never block execution** (opportunistic persistence)

**Intent Logger is opportunistic, not blocking.**

---

## Examples

### Example 1: Decision Recorded

**Input:**
- Conversation: User decides to use PostgreSQL over MongoDB
- Context: Database selection for feature-x
- Reasoning: PostgreSQL provides ACID guarantees needed for transactions

**Memory Entry:**
```markdown
## Database Selection for Feature X
**Timestamp:** 2026-01-24T15:30:00Z
**Context:** Feature X requires transactional data storage
**Decision:** Use PostgreSQL instead of MongoDB
**Reasoning:** PostgreSQL provides ACID guarantees required for financial transaction handling. MongoDB's eventual consistency model incompatible with regulatory requirements.
**Source:** Human
```

---

### Example 2: Trade-Off Documented

**Input:**
- MCP Decision: Choose eager loading over lazy loading for user profiles
- Context: Performance optimization
- Trade-Off: Higher memory usage for faster response times

**Memory Entry:**
```markdown
## Eager Loading Trade-Off for User Profiles
**Timestamp:** 2026-01-24T15:35:00Z
**Context:** User profile loading performance optimization
**Trade-Off:** Eager loading increases memory usage (~50MB per 1000 users) but reduces API response time from 300ms to 50ms
**Reasoning:** User experience prioritized over memory efficiency for this feature. 50MB overhead acceptable given server capacity (32GB RAM).
**Source:** directive-resolver
```

---

### Example 3: Write Failure (Memory Locked)

**Input:**
- Memory write attempt
- `/memory/decisions.md` is locked (e.g., FROZEN state)

**Behavior:**
```
[Intent Logger Warning]
Memory write skipped: /memory/decisions.md is locked
Entry would have been: "Architecture Decision: Use Microservices Pattern"
Execution continues without blocking.
```

**Result:** Execution proceeds, warning logged, no blocking

---

## Dependencies

**Allowed Dependencies:**
- Read conversation context
- Read MCP decision outputs
- Write to `/memory/decisions.md`
- Write to `/memory/known-tradeoffs.md`

**Forbidden Dependencies:**
- No writes outside `/memory`
- No policy modification
- No directive modification
- No baseline modification

---

## Integration Point

**When invoked:** After decisions are made, opportunistically

**Invocation pattern:**
```
Decision Made (Human or MCP)
    ↓
Intent Logger captures context
    ↓
Intent Logger checks if memory is writable
    ↓
[Writable] → Append to /memory/decisions.md or /memory/known-tradeoffs.md
[Locked] → Skip write, emit warning, continue
    ↓
Execution continues (never blocked)
```

---

## Non-Negotiable Rules

### Rule 1: Record Intent, Not Implementation

**You record WHY, not HOW.**

- ✅ "Chose PostgreSQL for ACID guarantees"
- ❌ "Created schema with tables: users, orders, transactions"

- ✅ "Traded memory for speed in profile loading"
- ❌ "Used SELECT * FROM users JOIN profiles"

---

### Rule 2: Append-Only

**Never edit or delete existing entries.**

- ✅ Append new entry
- ❌ Edit previous entry
- ❌ Delete entry
- ❌ Reorder entries

---

### Rule 3: Never Block Execution

**If memory write fails, warn and continue.**

- Write failure is not fatal
- Execution proceeds regardless
- Warning logged for human review

---

### Rule 4: Only Write to Memory

**Write scope is limited to `/memory` only.**

- ✅ `/memory/decisions.md`
- ✅ `/memory/known-tradeoffs.md`
- ❌ Any other path

---

## Version History

**v1.0** (2026-01-24) — Initial Intent Logger MCP

---

## Related Documents

- **BASELINE 003** — MCP Contract (Section 5.2: Memory MCP Designation)
- **POLICY 004** — Memory & Decision Persistence
- **POLICY 005** — MCP Interaction Authority
- **Directive 003** — Authorize MCP System Creation

---

## Compliance

This MCP is compliant with:
- BASELINE 003 (MCP Contract, designated memory MCP)
- POLICY 004 (Memory Persistence)
- POLICY 005 (MCP Interaction Authority)

**Authority:** Memory Write (Designated Memory MCP)
**Immutability:** Locked under BASELINE 003
