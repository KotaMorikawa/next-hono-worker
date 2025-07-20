-- x402 Learning Lab Database Initialization
-- This script runs when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create database if not exists (already handled by POSTGRES_DB env var)
-- Additional initialization can be added here

-- Set timezone
SET timezone = 'UTC';

-- Create indexes after tables are created by Drizzle migrations
-- These will be added via Drizzle migration files