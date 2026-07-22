-- Runs once on first database initialisation (mounted into
-- /docker-entrypoint-initdb.d). Enables the extensions the schema relies on.

CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector: embedding similarity search
CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive email column
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS cube;          -- dependency of earthdistance
CREATE EXTENSION IF NOT EXISTS earthdistance; -- geo radius search (matching)
