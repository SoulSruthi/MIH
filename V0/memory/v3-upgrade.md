# Decision — V3.0 Upgrade

**Date:** 2026-03-05
**Status:** Locked
**Codename:** v3_security_learning
**Authorizing Directive:** Human-requested upgrade from V2.1 to V3.0

## Summary

Upgraded Vibe Coding OS from V2.1 to V3.0, adding 5 new features inspired by Everything Claude Code best practices:

1. **AgentShield Security Scanning** — New MCP (agent-shield) scans code at Gate 4 for vulnerabilities
2. **Continuous Learning** — New MCP (learning-engine) extracts patterns post-Gate 5 and provides context at Gate 2
3. **Token Optimization** — New governance for context-efficient pipeline execution
4. **TDD-First Enforcement** — Gate 3 now follows RED → GREEN → REFACTOR cycle
5. **Pre-Commit Secret Detection** — Husky hook blocks commits with exposed credentials

## Components Added

### New Policies
- POLICY 009 — Security Scanning
- POLICY 010 — Continuous Learning
- POLICY 011 — Token Optimization
- POLICY 012 — TDD Enforcement
- POLICY 013 — Pre-Commit Secret Detection

### New Baselines
- BASELINE 005 — Agent-Shield Contract
- BASELINE 006 — Learning Engine Contract
- BASELINE 007 — Token Optimization Contract
- BASELINE 008 — TDD Contract
- BASELINE 009 — Pre-Commit Contract

### New MCPs
- agent-shield (security scanning)
- learning-engine (pattern extraction and recall)

### New Slash Commands
- /security-scan — Manual security scan
- /learn — Manual pattern extraction
- /token-report — Token usage report
- /tdd — Manual TDD cycle

## Non-Breaking

All existing POLICY 001-008 and BASELINE 001-004 are UNTOUCHED. New features integrate through additive policies, baselines, and CLAUDE.md v3.0 instructions.

---
