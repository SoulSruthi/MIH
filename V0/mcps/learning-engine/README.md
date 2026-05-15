# Learning Engine MCP

**Version**: 3.0.0
**Type**: Pattern Learner
**Introduced**: V3.0

## Purpose

Extracts reusable development patterns from completed pipeline runs and provides relevant patterns as context for new feature builds.

## Tools

| Tool | Purpose |
|------|---------|
| `extract_patterns` | Extract patterns from execution logs |
| `get_relevant_patterns` | Find patterns relevant to a new feature |
| `get_pattern_stats` | Get pattern statistics |

## Usage

Learning Engine is invoked automatically after Gate 5 completion (pattern extraction) and during Gate 2 orchestration (pattern retrieval). Can be triggered manually via the `/learn` command.

## Governance

- **Policy**: POLICY 010 — Continuous Learning
- **Baseline**: BASELINE 006 — Learning Engine Contract
- **Authority**: READ on /memory/logs, WRITE on /memory/learned/ only
