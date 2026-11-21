import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, testConnection, closePool, isPostgresConfigured } from './db.ts';
import type { SupportTicket } from '../src/types/findkart.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    ticketId: 'FK-SUP-4892',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-88412',
    category: 'Delivery & Shipping',
    subject: 'Package delayed at Bengaluru hub',
    message:
      'My SoundCore ANC Headphones shipment has been showing at Bengaluru Peenya hub since yesterday evening. Could you check the dispatch status?',
    status: 'Responded',
    createdAt: '2026-11-19T09:15:00.000Z',
    slaDueAt: '2026-11-19T15:15:00.000Z',
    assignedSpecialist: 'Priya Nair · Senior Delivery Specialist',
    replies: [
      {
        id: 'rep_4892_1',
        senderRole: 'specialist',
        senderName: 'Priya Nair',
        senderTitle: 'Senior Delivery Specialist · Bengaluru Support Desk',
        message:
          'Hi! I personally checked with our BlueDart Express hub coordinator in Peenya. Your parcel cleared line-haul sorting this morning and is scheduled for doorstep delivery tomorrow between 10:00 AM and 2:00 PM. We have flagged your pin code for priority dispatch.',
        createdAt: '2026-11-19T11:42:00.000Z',
      },
    ],
  },
  {
    ticketId: 'FK-SUP-4886',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-87904',
    category: 'Returns & Refunds',
    subject: 'Size exchange request for Linen Shirt',
    message:
      'I ordered size L in the UrbanWeave Linen Shirt, and would like to exchange it for size M. Tags and original pouch are intact.',
    status: 'Under Review',
    createdAt: '2026-11-18T14:20:00.000Z',
    slaDueAt: '2026-11-18T20:20:00.000Z',
    assignedSpecialist: 'Rohan Deshmukh · Apparel Care Desk',
    replies: [
      {
        id: 'rep_4886_1',
        senderRole: 'specialist',
        senderName: 'Rohan Deshmukh',
        senderTitle: 'Apparel Care Specialist · Human Review Desk',
        message:
          'Your exchange request is currently under review by our inventory team to reserve size M at our nearest fulfillment center. You will receive your pickup slot confirmation shortly.',
        createdAt: '2026-11-18T16:05:00.000Z',
      },
    ],
  },
  {
    ticketId: 'FK-SUP-4879',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-86219',
    category: 'Payment & Billing',
    subject: 'GST invoice copy needed for order',
    message:
      'Could you please share the itemized GST tax invoice PDF for my recent electronics accessories order?',
    status: 'Resolved',
    createdAt: '2026-11-17T08:10:00.000Z',
    slaDueAt: '2026-11-17T14:10:00.000Z',
    assignedSpecialist: 'Ananya Verma · Billing & GST Desk',
    replies: [
      {
        id: 'rep_4879_1',
        senderRole: 'specialist',
        senderName: 'Ananya Verma',
        senderTitle: 'Billing & GST Specialist',
        message:
          'We have generated and dispatched your signed GST tax invoice (#INV-FK-86219) to your registered email address with HSN codes and CGST/SGST split included.',
        createdAt: '2026-11-17T10:25:00.000Z',
      },
    ],
  },
  {
    ticketId: 'FK-SUP-3994',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-81105',
    category: 'Returns & Refunds',
    subject: 'Refund confirmation for returned kettle',
    message:
      'The delivery partner picked up my returned electric kettle on Monday. Please confirm when the refund will be credited.',
    status: 'Resolved',
    createdAt: '2026-11-12T10:30:00.000Z',
    slaDueAt: '2026-11-12T16:30:00.000Z',
    assignedSpecialist: 'Karthik Rao · Refunds Resolution Team',
    replies: [
      {
        id: 'rep_3994_1',
        senderRole: 'specialist',
        senderName: 'Karthik Rao',
        senderTitle: 'Refunds Resolution Specialist',
        message:
          'Good news — your returned BrewMaster Electric Kettle passed quality inspection at our warehouse, and your full refund has been processed back to your original payment method (Ref #RFND-992041).',
        createdAt: '2026-11-12T13:12:00.000Z',
      },
    ],
  },
];

export async function initPostgresDatabase(): Promise<{ success: boolean; message: string }> {
  if (!isPostgresConfigured()) {
    return {
      success: false,
      message: 'PostgreSQL is not configured. Set DATABASE_URL in your .env file.',
    };
  }

  const conn = await testConnection();
  if (!conn.connected) {
    return {
      success: false,
      message: `Failed to connect to PostgreSQL: ${conn.error}`,
    };
  }

  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Run schema statements
    await query(schemaSql);
    console.log('[PostgreSQL] Database schema tables and indexes verified successfully.');

    // Seed starter support tickets if table is empty
    const ticketsCountRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM support_tickets');
    const ticketCount = parseInt(ticketsCountRes.rows[0]?.count || '0', 10);

    if (ticketCount === 0) {
      console.log('[PostgreSQL] Seeding starter support tickets...');
      for (const t of INITIAL_SUPPORT_TICKETS) {
        await query(
          `INSERT INTO support_tickets (
            ticket_id, user_id, customer_name, email, order_id,
            category, subject, message, status, sla_due_at,
            assigned_specialist, replies, created_at
          ) VALUES ($1, $2, $3, LOWER($4), $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
          ON CONFLICT (ticket_id) DO NOTHING`,
          [
            t.ticketId,
            t.userId || null,
            t.customerName,
            t.email,
            t.orderId,
            t.category,
            t.subject,
            t.message,
            t.status,
            t.slaDueAt,
            t.assignedSpecialist,
            JSON.stringify(t.replies || []),
            t.createdAt,
          ]
        );
      }
      console.log(`[PostgreSQL] Seeded ${INITIAL_SUPPORT_TICKETS.length} reference tickets.`);
    }

    // Check if JSON file has data that should be migrated
    const jsonDbPath = path.resolve(process.cwd(), 'data', 'findkart-db.json');
    if (fs.existsSync(jsonDbPath)) {
      try {
        const raw = fs.readFileSync(jsonDbPath, 'utf8');
        const parsed = JSON.parse(raw);

        // Migrate users if users table is empty
        const usersCountRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(usersCountRes.rows[0]?.count || '0', 10);

        if (userCount === 0 && Array.isArray(parsed.users) && parsed.users.length > 0) {
          console.log(`[PostgreSQL] Migrating ${parsed.users.length} users from JSON db...`);
          for (const u of parsed.users) {
            await query(
              `INSERT INTO users (id, name, email, password_hash, password_salt, city, pincode, cart, wishlist, created_at)
               VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
               ON CONFLICT (id) DO NOTHING`,
              [
                u.id,
                u.name,
                u.email,
                u.passwordHash,
                u.passwordSalt,
                u.location?.city || 'Bengaluru',
                u.location?.pincode || '560001',
                JSON.stringify(u.cart || []),
                JSON.stringify(u.wishlist || []),
                u.createdAt || new Date().toISOString(),
              ]
            );

            // Also migrate user orders
            if (Array.isArray(u.orders)) {
              for (const ord of u.orders) {
                await query(
                  `INSERT INTO orders (order_id, user_id, created_at, status, subtotal, delivery_fee, total_savings, total, shipping, items)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
                   ON CONFLICT (order_id) DO NOTHING`,
                  [
                    ord.orderId,
                    u.id,
                    ord.createdAt || new Date().toISOString(),
                    ord.status || 'Confirmed',
                    ord.subtotal || 0,
                    ord.deliveryFee || 0,
                    ord.totalSavings || 0,
                    ord.total || 0,
                    JSON.stringify(ord.shipping || {}),
                    JSON.stringify(ord.items || []),
                  ]
                );
              }
            }
          }
        }

        // Migrate stock notifications if any
        if (Array.isArray(parsed.stockNotifications) && parsed.stockNotifications.length > 0) {
          for (const n of parsed.stockNotifications) {
            await query(
              `INSERT INTO stock_notifications (id, product_id, product_name, email, status, created_at)
               VALUES ($1, $2, $3, LOWER($4), $5, $6)
               ON CONFLICT (id) DO NOTHING`,
              [n.id, n.productId, n.productName, n.email, n.status || 'Subscribed', n.createdAt || new Date().toISOString()]
            );
          }
        }
      } catch (err) {
        console.warn('[PostgreSQL] Optional JSON migration skipped:', err);
      }
    }

    return {
      success: true,
      message: 'PostgreSQL database initialized successfully.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Database schema execution failed: ${errorMsg}`,
    };
  }
}

// When invoked directly from CLI: `tsx backend/init.ts`
if (process.argv[1] && process.argv[1].endsWith('init.ts')) {
  console.log('[PostgreSQL] Initializing database...');
  initPostgresDatabase()
    .then((result) => {
      console.log(result.message);
      return closePool();
    })
    .catch((err) => {
      console.error('[PostgreSQL] Init error:', err);
      process.exit(1);
    });
}
