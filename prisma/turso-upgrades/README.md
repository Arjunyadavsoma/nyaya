# Turso upgrade scripts (pre-migration deployments)

Existing production databases created with `prisma db push` (the pre-Stage-0
method) cannot use the Prisma migration history directly. Apply these
hand-reviewed, idempotent SQL scripts to them instead, in filename order:

    2026-11-12-stage0-auth-sessions.sql  — Session + RateLimitHit tables,
        User password/lockout columns.

Apply with the Turso CLI:

    turso db shell <database-name> < 2026-11-12-stage0-auth-sessions.sql

New deployments should NOT use these files — they get the full Prisma
migration chain in `prisma/migrations/` instead.
