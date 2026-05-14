#!/bin/bash
# ─────────────────────────────────────────────────────
# Vibe Coding OS V2.1 — Project Setup Script
#
# Usage: ./scripts/setup.sh
#
# This script bootstraps a new project from the
# Vibe Coding OS template. Run it once after cloning.
# ─────────────────────────────────────────────────────

set -e

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       Vibe Coding OS V2.1 — Project Setup       ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  This will initialize a new project using the   ║"
echo "║  fully autonomous development framework.        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Project Details ─────────────────────────

echo "━━━ Step 1: Project Details ━━━"
echo ""

read -p "Project name (lowercase, hyphens ok, e.g. finance-tracker): " PROJECT_NAME
read -p "Project description (1-2 sentences): " PROJECT_DESC
read -p "GitHub repo SSH URL (e.g. git@github.com:user/repo.git): " GITHUB_URL

echo ""
echo "Project: $PROJECT_NAME"
echo "Description: $PROJECT_DESC"
echo "GitHub: $GITHUB_URL"
echo ""
read -p "Confirm? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Setup cancelled."
  exit 0
fi

# ── Step 2: Update package.json ─────────────────────

echo ""
echo "━━━ Step 2: Updating package.json ━━━"

# Use node to update package.json properly
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = '$PROJECT_NAME';
pkg.description = '$PROJECT_DESC';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ package.json updated');
"

# ── Step 3: Connect Git Repo ────────────────────────

echo ""
echo "━━━ Step 3: Connecting Git Repository ━━━"

# Remove template origin, add project origin
git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_URL"
echo "✅ Git remote set to: $GITHUB_URL"

# ── Step 4: Supabase Connection ─────────────────────

echo ""
echo "━━━ Step 4: Supabase Connection ━━━"
echo ""
echo "You need a Supabase project. If you don't have one:"
echo "  1. Go to https://supabase.com/dashboard"
echo "  2. Click 'New Project'"
echo "  3. Get the project ref from the URL"
echo ""

read -p "Supabase project reference ID: " SUPA_REF
read -p "Supabase URL (https://xxx.supabase.co): " SUPA_URL
read -p "Supabase anon key: " SUPA_ANON

# Update .mcp.json
node -e "
const fs = require('fs');
const mcp = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
mcp.mcpServers.supabase.url = 'https://mcp.supabase.com/mcp?project_ref=$SUPA_REF';
fs.writeFileSync('.mcp.json', JSON.stringify(mcp, null, 2) + '\n');
console.log('✅ .mcp.json updated with Supabase ref');
"

# Create .env.local
cat > .env.local << ENVEOF
NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPA_ANON
ENVEOF
echo "✅ .env.local created"

# ── Step 5: Vercel Connection ───────────────────────

echo ""
echo "━━━ Step 5: Vercel Connection ━━━"
echo ""
echo "Run these commands after setup completes:"
echo "  npx vercel login      (if not logged in)"
echo "  npx vercel link       (connect this directory)"
echo "  npx vercel git connect (link GitHub for auto-deploys)"
echo ""
read -p "Press Enter to continue..."

# ── Step 6: Create Project Directive ────────────────

echo ""
echo "━━━ Step 6: Creating Initial Directive ━━━"

mkdir -p directives

cat > "directives/001-project-scaffold.md" << DIREOF
# Directive 001: Project Scaffold — $PROJECT_NAME

**Status:** AUTHORIZED
**Created:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Type:** Foundation

## Problem Statement
Initialize the $PROJECT_NAME project with a complete Next.js application scaffold including authentication, database connectivity, and core UI framework.

$PROJECT_DESC

## Success Criteria
- Next.js app runs locally with \`npm run dev\`
- Supabase connection works (can query database)
- Authentication flow functional (login/register)
- Base layout with navigation
- Tailwind CSS + shadcn/ui configured
- TypeScript strict mode passing
- Initial tests passing

## Constraints
- Tech stack: Next.js 16+, React 19+, TypeScript, Tailwind CSS, shadcn/ui, Supabase
- Use App Router (not Pages Router)
- Server Components by default, Client Components only when needed
- All data access through Supabase client libraries
- Mobile-responsive design

## Out of Scope
- Feature-specific functionality (handled by future directives)
- CI/CD pipeline setup
- Custom domain configuration
- Production deployment (preview only in V2.1)
DIREOF

echo "✅ directives/001-project-scaffold.md created"

# ── Step 7: Update Memory ───────────────────────────

echo ""
echo "━━━ Step 7: Recording Initialization ━━━"

mkdir -p memory/logs/execution

cat > "memory/project-init.md" << MEMEOF
# Project Initialization: $PROJECT_NAME

**Timestamp:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Framework:** Vibe Coding OS V2.1 (Fully Autonomous)

## Project Details
- **Name:** $PROJECT_NAME
- **Description:** $PROJECT_DESC
- **Repository:** $GITHUB_URL
- **Supabase Project:** $SUPA_REF

## Tech Stack
- Next.js 16+ (App Router)
- React 19+
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Auth)
- Vercel (deployment)

## Setup Decisions
- Single-user or multi-tenant: TBD by first feature directive
- Auth method: Supabase Auth (email + password default)
- Deployment model: Feature branches → Vercel preview → merge to main

## Status
- [x] Git repository connected
- [x] Supabase project connected
- [x] Initial directive created
- [ ] Vercel linked (manual step)
- [ ] Dependencies installed
- [ ] Initial scaffold built
MEMEOF

echo "✅ memory/project-init.md created"

# ── Step 8: Install Dependencies ────────────────────

echo ""
echo "━━━ Step 8: Installing Dependencies ━━━"
npm install
echo "✅ Dependencies installed"

# ── Step 9: Initial Commit ──────────────────────────

echo ""
echo "━━━ Step 9: Initial Commit ━━━"
git add .
git commit -m "feat: Initialize $PROJECT_NAME with Vibe Coding OS V2.1"
echo "✅ Initial commit created"

echo ""
read -p "Push to GitHub now? (y/n): " PUSH_CONFIRM
if [ "$PUSH_CONFIRM" = "y" ]; then
  git push -u origin main 2>/dev/null || git push -u origin HEAD:main
  echo "✅ Pushed to GitHub"
fi

# ── Done ────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              🚀 Setup Complete!                  ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  ✅ Project: $PROJECT_NAME"
echo "║  ✅ GitHub:  Connected"
echo "║  ✅ Supabase: Connected"
echo "║  ✅ Dependencies: Installed"
echo "║  ✅ Initial commit: Done"
echo "║                                                  ║"
echo "║  Next steps:                                     ║"
echo "║  1. npx vercel link (connect Vercel)             ║"
echo "║  2. Open in Claude Code                          ║"
echo "║  3. Say: 'Build feature: [your first feature]'   ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
