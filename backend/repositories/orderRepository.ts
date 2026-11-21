import { query } from '../db.ts';
import type { Order } from '../../src/types/findkart.ts';

export async function createOrder(order: Order, userId?: string): Promise<Order> {
  await query(
    `INSERT INTO orders (
      order_id, user_id, created_at, status,
      subtotal, delivery_fee, total_savings, total,
      shipping, items
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
    [
      order.orderId,
      userId || null,
      order.createdAt,
      order.status,
      order.subtotal,
      order.deliveryFee,
      order.totalSavings,
      order.total,
      JSON.stringify(order.shipping),
      JSON.stringify(order.items),
    ]
  );

  // If authenticated user placed order, clear their cart in DB
  if (userId) {
    await query(
      `UPDATE users SET cart = '[]'::jsonb, city = $1, pincode = $2 WHERE id = $3`,
      [order.shipping.city, order.shipping.pincode, userId]
    );
  }

  return order;
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  const res = await query(
    `SELECT order_id as "orderId", created_at as "createdAt", status,
            subtotal::float, delivery_fee::float as "deliveryFee",
            total_savings::float as "totalSavings", total::float,
            shipping, items
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return res.rows.map((row) => ({
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  })) as Order[];
}
