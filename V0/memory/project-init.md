# Project Init — MIH

> Written: 2026-05-14  
> Status: scaffold complete, integrations wired

## Identity

| Field | Value |
|---|---|
| Project name | MIH |
| GitHub repo | github.com/SoulSruthi/MIH |
| Working branch | claude/setup-v0-repo-BJ19C |
| OS version | Vibe Coding OS V5.0.0-rc.0 |

## Supabase

| Field | Value |
|---|---|
| Project ref | poooyfyonogxupnmxdcp |
| Project URL | https://poooyfyonogxupnmxdcp.supabase.co |
| Anon key | in `.env.local` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Service role key | in `.env.local` → `SUPABASE_SERVICE_ROLE_KEY` |
| Publishable key | in `.env.local` → `SUPABASE_PUBLISHABLE_KEY` |
| Management API (branch ops) | `SUPABASE_ACCESS_TOKEN` — **needs PAT** from supabase.com/dashboard/account/tokens |

## Vercel

| Field | Value |
|---|---|
| Project ID | prj_HCS4ktP9vRjgMFtOMc0LT5hgHew6 |
| Team ID | team_5HYHIblpKGwxJt4i84EcJsl0 |
| Token | in `.env.local` → `VERCEL_TOKEN` |

## MCP Servers

| Server | Status | Notes |
|---|---|---|
| `vibe-vercel` | ready | token + project + team all wired |
| `vibe-supabase` | partial | project ref wired; needs PAT for management API |
| `supabase-cloud` | pending | official Supabase HTTP MCP; needs OAuth PAT |
| `vibe-secret-scanner` | ready | no auth required |

## .env.local Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
SUPABASE_PROJECT_REF
SUPABASE_PUBLISHABLE_KEY
SUPABASE_ACCESS_TOKEN       ← populate when PAT is available
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_TEAM_ID
GITHUB_REPO
GITHUB_BRANCH
```
