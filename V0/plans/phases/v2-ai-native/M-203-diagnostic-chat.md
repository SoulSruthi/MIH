# M-203 · AI Diagnostic Chat

**Depends on:** M-108 (attribution engine), M-109 (ROI data)  
**Effort:** 7 days

## Purpose

A conversational interface where a marketing analyst can ask natural-language questions about campaign performance and receive AI-generated diagnoses backed by real attribution data.

## User Story

> As a marketing analyst, I want to ask "Why did Meta CPL spike last week?" and get an AI-generated diagnosis with at least 3 supporting data points, not just a chart I have to interpret myself.

---

## Supported Query Classes (V2)

| Query Class | Example | Data Sources |
|---|---|---|
| CPL change | "Why did Meta CPL spike last week?" | spend_daily, attribution_rollups |
| Source comparison | "Which source gave best quality leads in March?" | attribution_rollups, quality_grade distribution |
| Campaign triage | "Which Google campaigns are underperforming?" | attribution_rollups per campaign |
| Funnel drop | "Why is qualified→site visit conversion so low?" | crm_lifecycle_events aggregate |
| Spend anomaly | "Meta spend doubled but leads stayed flat, why?" | spend_daily, raw_lead counts |
| Cohort question | "How are March Meta leads doing now?" | cohort data (M-207) |

---

## Architecture

```
User message
    ↓
Query classifier (intent extraction — Haiku)
    ↓
Data fetcher (pulls relevant rows from DB — no LLM access to raw DB)
    ↓
Context builder (structured JSON of relevant metrics)
    ↓
Diagnosis generator (Sonnet — richer reasoning)
    ↓
Response with: diagnosis + data points + confidence + caveats
```

### T2 Agent Ceiling (P7)

The diagnostic AI is T2 — it **reads** data and **drafts** recommendations. It cannot:
- Trigger any state change
- Create, update, or delete any database row
- Initiate CRM events
- Execute budget changes

All T2 outputs are advisory only.

---

## Prompt Architecture

### System prompt (org-scoped, non-PII)
```
You are a marketing analytics assistant for a real estate developer.
You have access to aggregated campaign performance data for the past 90 days.
You must:
1. Base every claim on the data provided in <context>
2. Cite at least 3 supporting data points for any diagnosis
3. Express uncertainty when data is insufficient (< 7 days of data)
4. Never invent metrics not present in <context>
5. Never reveal internal system details, table names, or API keys

Your org: {org_name}
Current date: {current_date}
Data range: {data_start} to {data_end}
```

### Context window management
- Max context: 8,000 tokens (Haiku) / 32,000 tokens (Sonnet)
- Data fetcher caps rows at token budget before passing to LLM
- If data exceeds budget → sample most recent + most anomalous rows

### Conversation history
- Stored in `diagnostic_sessions` table (session_id, org_id, messages JSONB)
- Max 20 turns per session; older turns summarized automatically
- Sessions expire after 7 days

---

## In Scope

- `/dashboard/ai-chat` page — conversational UI
- Session management: new session per page load; previous sessions accessible
- Streaming responses (SSE or Vercel AI SDK `useChat`)
- Source citations: each claim hyperlinks to the underlying dashboard view
- Data freshness indicator: "Based on data through {last_sync_at}"
- Confidence display: high / medium / low per response
- Cost display (for org admins): "This query cost ₹X"

## Module Location

```
modules/ai/
  diagnostic-chat/
    index.ts            — session orchestrator
    classifier.ts       — query intent classification
    data-fetcher.ts     — structured DB queries (no raw SQL from LLM)
    context-builder.ts  — builds JSON context from DB results
    diagnosis.ts        — Sonnet call + response parsing
    session-store.ts    — diagnostic_sessions CRUD
    schema.ts           — zod schemas
  __tests__/
    diagnostic-chat.test.ts
    classifier.test.ts
    context-builder.test.ts

app/
  dashboard/
    ai-chat/
      page.tsx           — chat UI
      ChatSession.tsx    — streaming message component
      DataCitation.tsx   — clickable data point component
```

## Database

Migration `0023_diagnostic_sessions.sql`:
```sql
CREATE TABLE diagnostic_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  messages        jsonb NOT NULL DEFAULT '[]',
  total_cost_usd  numeric(10,6) DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
-- RLS: organization_id = app_org_id()

CREATE INDEX ON diagnostic_sessions (organization_id, last_active_at DESC);
```

## Acceptance Criteria

```
[ ] "Why did Meta CPL spike last week?" → response cites ≥3 data points from real attribution data
[ ] Query classifier correctly routes CPL / funnel / source comparison questions
[ ] Data fetcher never passes raw PII (phone, email, name) to LLM
[ ] Context builder caps token count; never exceeds model limit
[ ] Streaming: first token appears within 3 seconds
[ ] Session persists across page refreshes (same session_id)
[ ] Confidence label present on every response
[ ] Agent actions logged: every Sonnet call → agent_actions table
[ ] T2 ceiling enforced: chat responses are advisory text only, no action buttons
[ ] Org admin can see total AI spend for diagnostic sessions this month
```
