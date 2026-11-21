import { query } from '../db.ts';
import type { StockNotification } from '../../src/types/findkart.ts';

interface NotificationRow {
  id: string;
  product_id: string;
  product_name: string;
  email: string;
  status: 'Subscribed' | 'Notified';
  created_at: Date | string;
}

function mapRowToNotification(row: NotificationRow): StockNotification {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    email: row.email,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function getStockOverrides(): Promise<Record<string, number>> {
  const res = await query<{ product_id: string; stock: number }>(
    `SELECT product_id, stock FROM stock_overrides`
  );

  const overrides: Record<string, number> = {};
  for (const row of res.rows) {
    overrides[row.product_id] = row.stock;
  }
  return overrides;
}

export async function setStockOverride(productId: string, stock: number): Promise<void> {
  await query(
    `INSERT INTO stock_overrides (product_id, stock, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (product_id)
     DO UPDATE SET stock = EXCLUDED.stock, updated_at = NOW()`,
    [productId, stock]
  );
}

export async function batchUpdateStockOverrides(updates: Record<string, number>): Promise<void> {
  for (const [productId, stock] of Object.entries(updates)) {
    await setStockOverride(productId, stock);
  }
}

export async function getNotificationsByEmail(email: string): Promise<StockNotification[]> {
  const res = await query<NotificationRow>(
    `SELECT id, product_id, product_name, email, status, created_at
     FROM stock_notifications
     WHERE LOWER(email) = LOWER($1)
     ORDER BY created_at DESC`,
    [email.trim()]
  );

  return res.rows.map(mapRowToNotification);
}

export async function findNotification(
  productId: string,
  email: string
): Promise<StockNotification | null> {
  const res = await query<NotificationRow>(
    `SELECT id, product_id, product_name, email, status, created_at
     FROM stock_notifications
     WHERE product_id = $1 AND LOWER(email) = LOWER($2)
     LIMIT 1`,
    [productId, email.trim()]
  );

  if (res.rows.length === 0) return null;
  return mapRowToNotification(res.rows[0]);
}

export async function createNotification(
  notification: StockNotification
): Promise<StockNotification> {
  await query(
    `INSERT INTO stock_notifications (id, product_id, product_name, email, status, created_at)
     VALUES ($1, $2, $3, LOWER($4), $5, $6)`,
    [
      notification.id,
      notification.productId,
      notification.productName,
      notification.email,
      notification.status,
      notification.createdAt,
    ]
  );

  return notification;
}
