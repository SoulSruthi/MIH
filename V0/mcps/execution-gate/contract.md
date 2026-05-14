# Execution Gate MCP Contract

**Compliant with:** BASELINE 003 — MCP Contract Specification
**Version:** 1.0
**Effective Date:** 2026-01-24
**Authorized By:** Directive 003

---

## 1. IDENTITY

**Name:** execution-gate
**Version:** 1.0
**Domain:** Execution Approval and Control
**Owner:** Human-defined, AI-executable (read-only evaluation)

---

## 2. RESPONSIBILITY

### 2.1 Allowed
- Receive input signals from Structure Guardian, Directive Resolver, and proposed changes
- Evaluate proposed changes against policy rules
- Determine execution safety
- Return verdict: EXECUTE, ADVISE_ONLY, or HALT
- Enforce HALT conditions
- Enforce safety rules

### 2.2 Forbidden
- Generate diffs or changes
- Suggest modifications
- Execute approved changes (delegates to execution layer)
- Override policy rules
- Make exceptions to HALT conditions
- Write any files

### 2.3 Never-Do
- Bypass HALT conditions
- Override Structure Guardian or Directive Resolver failures
- Grant execution when authority is ambiguous
- Modify policies or directives
- Persist state

---

## 3. INPUTS

### 3.1 Required Inputs
- Structure Guardian status (`STRUCTURE_OK` or `STRUCTURE_FAIL`)
- Directive Resolver resolution (`RESOLUTION_STATE` object)
- Proposed changes (diff preview, target paths, change types)
- MCP requesting execution (identity and authority level)

### 3.2 Optional Inputs
- Repository context (git status, branch info)
- User confirmation signals

### 3.3 Validation Rules
- If Structure Guardian failed → immediate HALT
- If Directive Resolver has unresolved conflicts → immediate HALT
- All required inputs must be present

---

## 4. OUTPUTS

### 4.1 Guaranteed Outputs
Returns ONLY one of: `EXECUTE`, `ADVISE_ONLY`, `HALT`

With optional context:
```
HALT
Reason: [specific violation]
Violated Rule: [policy or contract section]
Remediation: [what must be done to unblock]
```

### 4.2 Failure Modes
- **HALT on Structure Guardian failure**
- **HALT on unresolved conflicts**
- **HALT on unauthorized paths**
- **HALT on policy drift**
- **HALT on memory corruption risk**
- **HALT on MCP scope violations**
- **HALT on FROZEN state without override**

---

## 5. SIDE EFFECTS

### 5.1 Explicitly Allowed Side Effects
None. Pure read-only evaluation.

### 5.2 Forbidden Side Effects
- File creation, modification, deletion
- Directory operations
- Memory persistence
- State storage

---

## 6. DEPENDENCIES

### 6.1 Allowed Dependencies
- Read Structure Guardian output
- Read Directive Resolver output
- Read proposed change diffs
- Read MCP execution requests
- Read repository state

### 6.2 Forbidden Dependencies
- No write access
- No modification capabilities
- No external network calls
- No other MCP invocations

---

## 7-18. [STANDARD BASELINE 003 SECTIONS]

All standard MCP contract sections apply as defined in BASELINE 003.

**Key Points:**
- Read-only operation (zero write capability)
- Stateless execution
- No self-modification
- No input invention
- No intent assumption
- Constitutional immutability
- Strict enforcement of HALT conditions

---

## COMPLIANCE STATEMENT

**This MCP contract is compliant with:**
- BASELINE 003 (MCP Contract Specification)
- POLICY 001 (Structural Integrity)
- POLICY 002 (Execution Gating)
- POLICY 005 (MCP Interaction Authority)
- Directive 003 (Authorization)

**Authority Level:** Executory Control (Final Verdict)
**Immutability:** Locked under BASELINE 003

**END OF EXECUTION GATE MCP CONTRACT**
