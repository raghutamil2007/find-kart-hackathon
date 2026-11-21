/**
 * FindKart — Kafka event publishers
 * One typed helper per domain event.
 */

import { publishEvent, TOPICS } from './kafka.ts';
import type { Order, StockNotification } from '../types/findkart.ts';

// ─── Order placed ─────────────────────────────────────────────────────────────
export async function publishOrderPlaced(order: Order, userId: string): Promise<void> {
  await publishEvent(TOPICS.ORDERS, order.orderId, {
    event: 'ORDER_PLACED',
    orderId: order.orderId,
    userId,
    status: order.status,
    total: order.total,
    itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
    items: order.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    })),
    shipping: {
      city: order.shipping.city,
      pincode: order.shipping.pincode,
      paymentMethod: order.shipping.paymentMethod,
    },
    createdAt: order.createdAt,
  });
  console.log(`[Kafka] ✅ ORDER_PLACED published — ${order.orderId}`);
}

// ─── Stock update ─────────────────────────────────────────────────────────────
export async function publishStockUpdate(
  productId: string,
  productName: string,
  previousStock: number,
  newStock: number,
  updatedBy: string,
): Promise<void> {
  await publishEvent(TOPICS.STOCK_UPDATES, productId, {
    event: 'STOCK_UPDATED',
    productId,
    productName,
    previousStock,
    newStock,
    delta: newStock - previousStock,
    updatedBy,
  });
  console.log(`[Kafka] ✅ STOCK_UPDATED published — ${productId}: ${previousStock} → ${newStock}`);
}

// ─── Stock notification subscribed ───────────────────────────────────────────
export async function publishStockNotification(notification: StockNotification): Promise<void> {
  await publishEvent(TOPICS.STOCK_NOTIFICATIONS, notification.productId, {
    event: 'STOCK_NOTIFICATION_SUBSCRIBED',
    notificationId: notification.id,
    productId: notification.productId,
    productName: notification.productName,
    email: notification.email,
    status: notification.status,
    createdAt: notification.createdAt,
  });
  console.log(`[Kafka] ✅ STOCK_NOTIFICATION_SUBSCRIBED published — ${notification.productId} → ${notification.email}`);
}

// ─── Chat / AI event ─────────────────────────────────────────────────────────
export async function publishChatEvent(params: {
  sessionId: string;
  userId?: string;
  query: string;
  reply: string;
  matchCount: number;
  durationMs: number;
}): Promise<void> {
  await publishEvent(TOPICS.CHAT_EVENTS, params.sessionId, {
    event: 'CHAT_QUERY',
    ...params,
  });
  console.log(`[Kafka] ✅ CHAT_QUERY published — session:${params.sessionId}`);
}
