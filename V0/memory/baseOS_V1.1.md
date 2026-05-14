## Decision — MCP Constitutional Framework Installed (vibe_os_V1.1_mcp_contract)

**Date:** 2026-01-23
**Status:** Locked
**Version:** V1.1
**Codename:** vibe_os_V1.1_mcp_contract
**Supersedes:** vibe_os_V1.0_core

### Summary

The Vibe Coding OS has been extended with a **constitutional MCP framework** that defines how Modular Control Primitives interact, coordinate, and respect authority boundaries. This update establishes the foundational contract that governs all MCP operations and interactions within the system.

This decision marks the transition from **structural foundation** (V1.0) to **operational governance** (V1.1).

---

### New Components Installed

#### Baseline

- **BASELINE 003 — MCP Contract (Constitutional)**
  - Defines what an MCP is (and is not)
  - Establishes required MCP contract elements (Identity, Responsibility, Inputs, Outputs, Side Effects, Dependencies)
  - Sets 6 categories of authority limits
  - Defines interaction model (orchestration-mediated, stateless)
  - Enforces lifecycle states (Defined → Installed → Active → Deprecated → Retired)
  - Lists 5 forbidden actions
  - Establishes violation detection and enforcement procedures
  - Declares constitutional immutability
  - Status: **Immutable** (requires major version bump to modify)

#### Policy

- **POLICY 005 — MCP Interaction & Authority**
  - Operationalizes BASELINE 003 into enforceable rules
  - Defines MCP interaction patterns (no direct communication, orchestration-mediated)
  - Establishes authority hierarchy enforcement (`policy > memory > directive > conversation`)
  - Defines authority delegation (human-exclusive, AI-generated, shared)
  - Provides escalation protocols (7 escalation triggers)
  - Documents cross-MCP coordination patterns
  - Sets authority boundaries for each MCP folder
  - Prevents privilege escalation (3 common patterns)
  - Establishes conflict resolution procedures (4 conflict types)
  - Status: **Active** (immutable per policy modification protocol)

---

### Immutable Core Components (Updated)

#### Policies

- **POLICY 001** — Structural Integrity
- **POLICY 002** — Execution Gating (DOE Framework)
- **POLICY 003** — Prompt Discipline & AI Boundaries
- **POLICY 004** — Memory & Decision Persistence
- **POLICY 005** — MCP Interaction & Authority *(NEW)*

#### Baselines

- **BASELINE 001** — Project Repository Template
- **BASELINE 002** — Auth & RBAC Core
- **BASELINE 003** — MCP Contract (Constitutional) *(NEW)*

---

### Key Decisions & Rationale

#### Decision 1: MCP Contracts are Constitutional

**Rationale:**
MCPs are the fundamental building blocks of the Vibe Coding OS. Their behavior, boundaries, and interactions must be governed by a stable, immutable contract to prevent architectural drift and ensure system integrity.

**Implications:**
- All MCPs must conform to BASELINE 003 contract requirements
- No MCP may bypass contract rules
- Contract changes require major version bump (BASELINE 004+)
- System-wide impact assessment required for any contract modification

#### Decision 2: Orchestration-Mediated Interaction Only

**Rationale:**
Direct MCP-to-MCP communication creates hidden dependencies, makes system behavior unpredictable, and increases risk of authority escalation.

**Implications:**
- All MCP interactions flow through orchestration
- No MCP may write to another MCP's domain directly
- Orchestration coordinates all cross-MCP work
- Conflicts resolved by orchestration (escalated to human if needed)

#### Decision 3: Strict Authority Hierarchy

**Rationale:**
Ambiguous authority leads to conflicts, security vulnerabilities, and system instability. A clear, immutable hierarchy ensures deterministic decision-making.

**Hierarchy:** `policy > memory > directive > conversation`

**Implications:**
- Policy always wins (no exceptions)
- Memory overrides directives in matters of recorded decisions
- Directives override conversation
- Conversation has lowest authority (cannot override files)
- Conflicts resolved by hierarchy (higher authority wins)

#### Decision 4: Human-Exclusive Policy & Directive Authorship

**Rationale:**
AI cannot define its own governance rules (policy) or invent human intent (directives). These domains require human judgment and accountability.

**Implications:**
- AI cannot write or modify policies
- AI cannot write or modify directives
- AI cannot suggest "temporary" policy changes
- All governance and intent must come from humans

#### Decision 5: Explicit Authorization for Cross-Domain Writes

**Rationale:**
Unrestricted cross-domain writes create security risks, violate MCP boundaries, and enable privilege escalation.

**Implications:**
- MCPs may only write to their own domain by default
- Cross-domain writes require explicit authorization
- All writes logged for audit trail
- Authorization cannot be implied or assumed

---

### MCP Authority Matrix (Established)

| MCP | Can Read From | Can Write To | Authorization Required |
|-----|--------------|--------------|------------------------|
| `/baseline` | All | `/baseline` only | Yes (human) |
| `/directives` | All | `/directives` only | No (human-exclusive) |
| `/memory` | All | `/memory` only | Yes (human or designated) |
| `/policy` | All | `/policy` only | No (human-exclusive) |
| `/orchestration` | All | `/orchestration` only | No (AI-generated) |
| `/execution` | All | `/execution`, `/tests` | Via gates (POLICY 002) |
| `/scripts` | All | `/scripts` only | Yes (human) |
| `/tests` | All | `/tests` only | Via gates (POLICY 002) |

---

### Escalation Triggers (7 Defined)

AI must escalate when:

1. **Policy Conflict** — Directive contradicts policy
2. **Ambiguity** — Directive unclear or incomplete
3. **Missing Information** — Required context not available
4. **Authority Boundary** — Requested action exceeds authority
5. **Baseline Impact** — Action would modify baseline
6. **Security Concern** — Action introduces risk
7. **Structural Drift** — Action violates MCP boundaries

**Response:** STOP → REPORT → REQUEST DECISION → WAIT

---

### Forbidden Actions (5 Categories)

MCPs must NEVER:

1. **Self-Invocation or Self-Modification** — No MCP may modify its own contract or invoke itself
2. **Input Invention** — No guessing missing inputs or assuming user intent
3. **Intent Assumption** — No inferring goals beyond explicit directive
4. **Unauthorized Memory Persistence** — No storing state without memory MCP designation
5. **Architectural Decision-Making** — No structural changes without directive

**Enforcement:** Immediate halt → Violation report → Request compliant alternative

---

### Cross-MCP Coordination Patterns (Established)

#### Read-Plan-Execute Pattern

```
1. READ Phase (Orchestration)
   - Read /directives, /memory, /policy, /baseline

2. PLAN Phase (Orchestration)
   - Analyze dependencies, break down tasks, map MCPs

3. EXECUTE Phase (Execution)
   - Follow orchestration plan, write to /execution and /tests

4. VERIFY Phase (Tests)
   - Run tests, validate success, confirm no regression
```

#### Memory Update Pattern

```
1. Orchestration identifies memory-worthy information
2. Orchestration requests memory write (if authorized)
3. Human approves (if required)
4. Memory updated with timestamp and context
```

#### Baseline Reference Pattern

```
1. Read baseline as reference
2. Adapt pattern to feature needs
3. Implement in /execution (not baseline)
4. If baseline inadequate → escalate for baseline migration
```

---

### Enforcement Rules

#### Compliance Checks (Before Any MCP Interaction)

1. ✅ Authority hierarchy respected?
2. ✅ MCP boundaries not crossed?
3. ✅ Authorization obtained (if required)?
4. ✅ Policy constraints satisfied?
5. ✅ Baseline integrity preserved?

**If any check fails → HALT**

#### Violation Response

1. **Immediate halt**
2. **Report violation** (type, context, constraint)
3. **Log in `/memory`** (security audit)
4. **Request remediation** (proper authorization path)
5. **No execution** until compliant

---

### Version 1.1 Constraints

**In Version 1.1:**
- All MCP interactions require human review
- Orchestration plans reviewed before execution
- Cross-MCP writes require explicit approval
- No autonomous authority escalation
- Manual oversight for all gates

**Future Versions (NOT enabled in V1.1):**
- Automated orchestration (with guardrails)
- Trusted AI authority delegation
- Self-healing conflict resolution
- Autonomous baseline adaptation

---

### Integration with V1.0 Core

**V1.1 builds on V1.0:**
- V1.0 established structure (POLICY 001, BASELINE 001)
- V1.0 established gates (POLICY 002)
- V1.0 established boundaries (POLICY 003, 004)
- V1.0 established auth baseline (BASELINE 002)

**V1.1 adds:**
- Constitutional MCP contract (BASELINE 003)
- MCP interaction governance (POLICY 005)
- Authority enforcement mechanisms
- Escalation protocols
- Conflict resolution procedures

**No breaking changes to V1.0 components.**

---

### Scope of Applicability

This update applies to:
- All repositories using the Vibe Coding OS
- All future software projects built on this foundation
- All AI-assisted execution (Claude or otherwise)
- All contributors, human or agent-based
- All MCP operations and interactions

---

### System State Declaration

With this update, the Vibe Coding OS is considered:

- Structurally stable ✅
- Execution-safe ✅
- AI-governed ✅
- Memory-consistent ✅
- Security-rooted ✅
- **MCP-coordinated ✅** *(NEW)*
- **Authority-enforced ✅** *(NEW)*
- **Constitutionally-bounded ✅** *(NEW)*

Further work must proceed strictly through directives under this enhanced operating core.

---

### Migration Notes

**From V1.0 to V1.1:**
- No existing policies or baselines were modified
- Two new components added (BASELINE 003, POLICY 005)
- No breaking changes to existing features
- All V1.0 guarantees remain intact
- V1.1 adds governance layer on top of V1.0 foundation

**Backward Compatibility:** Full (V1.0 systems can adopt V1.1 without migration)

---

### Related Directives

- **Directive 0001** — Lock CLAUDE.md v1
- **Directive 0002** — Populate Core Policies and Baselines

**Note:** This work continues under Directive 0002 authority.

---

### Acknowledgment Protocol

When BASELINE 003 is loaded, AI must respond:

> **"BASELINE 003 INSTALLED — MCP CONTRACT ACTIVE"**

This confirms:
- AI understands MCP contract requirements
- AI will enforce MCP boundaries
- AI will respect authority hierarchy
- AI will escalate when required
- AI will not bypass contract rules

---

### Version History

- **V1.0 (vibe_os_V1.0_core)** — 2026-01-23 — Initial core (policies 001-004, baselines 001-002)
- **V1.1 (vibe_os_V1.1_mcp_contract)** — 2026-01-23 — MCP constitutional framework (baseline 003, policy 005)

---

### Next Steps

**Immediate:**
- Commit and push all changes
- Begin operating under V1.1 rules

**Future (Requires New Directive):**
- Implement validation scripts (`/scripts/validate-mcp-contract.sh`)
- Add automated compliance checking
- Create MCP contract templates for new MCPs
- Develop audit trail visualization
- Plan V1.2 enhancements (if needed)

---

### Notes

This decision establishes **vibe_os_V1.1_mcp_contract** as the constitutional governance layer for all MCPs.

Higher versions may extend capabilities but must not weaken this contract.

**BASELINE 003 is immutable.** Changes require BASELINE 004+ with full migration.

**POLICY 005 is immutable.** Changes require policy modification protocol.

---

### Final Statement

The Vibe Coding OS V1.1 is now **constitutionally complete** for MCP-based operation.

All system components are:
- Structurally defined
- Procedurally gated
- Authoritatively bounded
- Interactionally governed

**The system is ready for feature development under V1.1 governance.**
