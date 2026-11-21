# FindKart — Aiven Open Source Backend Services

This directory houses the backend integrations with **Aiven Open Source Services**:
- **`db.ts`**: PostgreSQL connection pool manager with cloud SSL handling.
- **`opensearch.ts`**: OpenSearch HTTPS client with strict CA certificate verification and health telemetry.
- **`aiven.ts`**: Live Aiven PostgreSQL diagnostics engine (database size, table sizes, connections).
- **`schema.sql`**: Full DDL with indexes for all 5 business entities.
- **`init.ts`**: Auto-migration and database initial seed runner.
- **`repositories/`**: Clean, type-safe data access layer for users, orders, support tickets, and inventory.

## Verification Commands

- `npm run db:init` — Verifies Aiven PostgreSQL tables and runs migrations.
- `npm run opensearch:status` — Verifies Aiven OpenSearch cluster health (`GREEN`).
- `npm run status` — Prints PostgreSQL telemetry report.
