/**
 * FindKart — Kafka client singleton
 * Uses KafkaJS connecting to a local broker (localhost:9092 by default).
 * Override via KAFKA_BROKERS env var (comma-separated).
 */

import { Kafka, type Producer, type Consumer, Partitioners, logLevel } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

export const kafka = new Kafka({
  clientId: 'findkart-server',
  brokers,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
});

// ─── Topics ──────────────────────────────────────────────────────────────────
export const TOPICS = {
  ORDERS:              'findkart.orders',
  STOCK_UPDATES:       'findkart.stock.updates',
  STOCK_NOTIFICATIONS: 'findkart.stock.notifications',
  CHAT_EVENTS:         'findkart.chat.events',
} as const;

export type KafkaTopic = (typeof TOPICS)[keyof typeof TOPICS];

// ─── Shared producer ─────────────────────────────────────────────────────────
let _producer: Producer | null = null;
let _producerConnected = false;

export async function getProducer(): Promise<Producer> {
  if (!_producer) {
    _producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  }
  if (!_producerConnected) {
    await _producer.connect();
    _producerConnected = true;
    console.log('[Kafka] Producer connected');
  }
  return _producer;
}

export async function disconnectProducer(): Promise<void> {
  if (_producer && _producerConnected) {
    await _producer.disconnect();
    _producerConnected = false;
    _producer = null;
    console.log('[Kafka] Producer disconnected');
  }
}

// ─── Publish helper ───────────────────────────────────────────────────────────
export async function publishEvent(
  topic: KafkaTopic,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const producer = await getProducer();
  await producer.send({
    topic,
    messages: [
      {
        key,
        value: JSON.stringify({ ...value, _publishedAt: new Date().toISOString() }),
      },
    ],
  });
}

// ─── Consumer factory ─────────────────────────────────────────────────────────
export function createConsumer(groupId: string): Consumer {
  return kafka.consumer({ groupId });
}
