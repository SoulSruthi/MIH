-- =================================================================
-- Migration: 014_mih_schema
-- Purpose: Create mih schema with LTREE extension
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- Enable LTREE extension (required for taxonomy_path)
CREATE EXTENSION IF NOT EXISTS ltree;

-- Create mih schema
CREATE SCHEMA IF NOT EXISTS mih;

-- Grant usage on mih schema to authenticated and service role
GRANT USAGE ON SCHEMA mih TO authenticated, service_role, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA mih
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
