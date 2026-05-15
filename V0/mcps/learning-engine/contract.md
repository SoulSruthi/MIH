# Learning Engine MCP — Contract

**Compliant with**: BASELINE 003 — MCP Contract (Constitutional)

## Identity

| Field | Value |
|-------|-------|
| Name | learning-engine |
| Version | 3.0.0 |
| Domain | Development pattern extraction and recall |
| Pipeline Role | Post-Gate 5 (extraction) + Gate 2 (context) |

## Responsibility

Extract reusable patterns from execution logs and provide relevant patterns for new feature builds.

## Inputs

- `extract_patterns`: directive, execution_log_path
- `get_relevant_patterns`: feature_description, categories (optional), min_confidence (optional)
- `get_pattern_stats`: (no inputs)

## Outputs

- ExtractionResult: patterns extracted, new vs updated counts
- RelevanceResult: matching patterns, auto-apply vs suggestions
- PatternStats: total, by category, by confidence, most used

## Side Effects

- WRITE to `/memory/learned/patterns.md`
- STATUS_QUERY to intent-logger via Message Bus

## Authority Limits

- READ: /memory/logs/execution, /memory/learned, /orchestration, /specs
- WRITE: /memory/learned/ ONLY
- NEVER: Modify source code, policies, baselines, execution logs

## Dependencies

- Intent Logger (reading execution logs)
- Message Bus (communication)
- Speckit (receives relevant patterns at Gate 2)

## Forbidden Actions

Per BASELINE 003: No self-invocation, input invention, intent assumption, unauthorized memory writes, architectural decisions.
