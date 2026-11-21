# FindKart PostgreSQL Backend

This folder contains the complete PostgreSQL database layer for FindKart.

## Architecture

- **`db.ts`**: Connection pool management with `pg.Pool`, SSL auto-detection for cloud providers, connection testing, and query helper.
- **`schema.sql`**: Complete DDL with indexes for:
  - `users` (accounts, salted passwords, JSONB cart & wishlist, delivery location)
  - `orders` (order details, shipping info, line items, user linkage)
  - `support_tickets` (customer care tickets, specialist assignments, 6-hr SLA tracking)
  - `stock_overrides` (real-time catalog stock adjustments)
  - `stock_notifications` (restock notification alert subscriptions)
- **`init.ts`**: Automatic database initialization, table creation, and seed data migration.
- **`repositories/`**: Clean, type-safe data access layer:
  - `userRepository.ts`: Auth, user lookup, cart/wishlist sync, address management.
  - `orderRepository.ts`: Checkout, order placement, order history.
  - `supportRepository.ts`: Ticket creation, responses, status tracking.
  - `stockRepository.ts`: Stock overrides, restock notifications.

## Quick Start Configuration

Add your PostgreSQL connection string in `.env` in the project root:

```env
# Cloud PostgreSQL (Neon / Supabase / Render / Railway)
DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/findkart?sslmode=require"

# Or Local PostgreSQL (Default port 5432)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/findkart"
```

## Running Database Initialization

To manually test and initialize your PostgreSQL tables:
```bash
npm run db:init
```

The database tables are also automatically verified and created when you start the server:
```bash
npm run dev
```

## Optional: Local Docker PostgreSQL

If you prefer running a local PostgreSQL container, run:
```bash
docker compose up -d
```
This starts PostgreSQL on port `5432` with user `postgres` and database `findkart`.
