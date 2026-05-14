# Agent-Shield MCP — Contract

**Compliant with**: BASELINE 003 — MCP Contract (Constitutional)

## Identity

| Field | Value |
|-------|-------|
| Name | agent-shield |
| Version | 3.0.0 |
| Domain | Code security scanning |
| Pipeline Role | Gate 4 sub-step |

## Responsibility

Scan source code for security vulnerabilities and report findings. Never modify code.

## Inputs

- `scan_files`: paths[], scope, directive
- `scan_staged`: directive
- `get_scan_report`: directive (optional)

## Outputs

- SecurityFinding[]: severity, category, file, line, description, suggested_fix
- ScanReport: verdict (PASS/FAIL), summary counts, findings list

## Side Effects

- WRITE to `/memory/logs/execution/[date]_security-scan.md`
- GATE_SIGNAL to execution-gate via Message Bus
- STATUS_QUERY to intent-logger via Message Bus

## Authority Limits

- READ: /src, /tests, /execution, package.json
- WRITE: /memory/logs/execution/ ONLY
- NEVER: Modify source code, policies, baselines

## Dependencies

- Structure Guardian (STRUCTURE_OK prerequisite)
- Message Bus (communication)
- Intent Logger (finding persistence)

## Forbidden Actions

Per BASELINE 003: No self-invocation, input invention, intent assumption, unauthorized memory writes, architectural decisions.
