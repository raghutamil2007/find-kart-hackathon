# FindKart — Aiven Open Source PostgreSQL Backend

This directory houses the backend database integration with **Aiven for PostgreSQL**.

## Files Overview

- **`aiven.ts`**: Aiven diagnostics engine. Queries database sizing, active connections, table sizes, and service health.
- **`db.ts`**: Connection pool manager. Features automated SSL URL cleaning for Aiven cloud certificates (`{ rejectUnauthorized: false }`).
- **`schema.sql`**: Full DDL with indexes for all 5 business entities.
- **`init.ts`**: Auto-migration runner.
- **`repositories/`**: Clean data-access methods:
  - `userRepository.ts`
  - `orderRepository.ts`
  - `supportRepository.ts`
  - `stockRepository.ts`

## Aiven Endpoints

- `GET /api/aiven/status` — Returns live service health, PostgreSQL version, database size, active connections, and table metrics.
- `GET /api/db/status` — General database connection health check.
