# Agent-Shield MCP

**Version**: 3.0.0
**Type**: Security Scanner
**Introduced**: V3.0

## Purpose

Scans application source code for security vulnerabilities before deployment. Runs as a Gate 4 sub-step after build and tests pass.

## Tools

| Tool | Purpose |
|------|---------|
| `scan_files` | Scan specified paths for vulnerabilities |
| `scan_staged` | Scan git-staged files for vulnerabilities |
| `get_scan_report` | Get latest scan report summary |

## Usage

Agent-Shield is invoked automatically during Gate 4 verification. It can also be triggered manually via the `/security-scan` command.

## Governance

- **Policy**: POLICY 009 — Security Scanning
- **Baseline**: BASELINE 005 — Agent-Shield Contract
- **Authority**: READ-ONLY on source code, WRITE to /memory/logs/execution/ only
