import { query, testConnection, isPostgresConfigured } from './db.ts';

export interface AivenServiceInfo {
  provider: 'Aiven' | 'Self-Hosted' | 'Other Cloud';
  isAiven: boolean;
  serviceHost: string;
  port: number;
  database: string;
  sslMode: string;
}

export interface AivenTableStats {
  tableName: string;
  rowCount: number;
  totalSize: string;
}

export interface AivenServiceStatus {
  service: string;
  provider: string;
  connected: boolean;
  latencyMs?: number;
  host: string;
  database: string;
  version?: string;
  databaseSize?: string;
  databaseBytes?: number;
  activeConnections?: number;
  tables: AivenTableStats[];
  serverTime?: string;
  error?: string;
}

export function parseAivenServiceInfo(): AivenServiceInfo {
  const dbUrl = process.env.DATABASE_URL?.trim() || '';

  if (!dbUrl) {
    return {
      provider: 'Self-Hosted',
      isAiven: false,
      serviceHost: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'findkart',
      sslMode: 'disabled',
    };
  }

  try {
    const url = new URL(dbUrl);
    const host = url.hostname;
    const isAiven = host.includes('.aivencloud.com') || host.includes('.aiven.io');

    return {
      provider: isAiven ? 'Aiven' : 'Other Cloud',
      isAiven,
      serviceHost: host,
      port: Number(url.port) || 5432,
      database: url.pathname.replace(/^\//, '') || 'defaultdb',
      sslMode: url.searchParams.get('sslmode') || (isAiven ? 'require (TLS 1.3)' : 'prefer'),
    };
  } catch {
    return {
      provider: 'Other Cloud',
      isAiven: dbUrl.includes('.aivencloud.com'),
      serviceHost: 'remote-pg',
      port: 5432,
      database: 'findkart',
      sslMode: 'require',
    };
  }
}

export async function getAivenServiceStatus(): Promise<AivenServiceStatus> {
  const info = parseAivenServiceInfo();

  if (!isPostgresConfigured()) {
    return {
      service: 'Aiven for PostgreSQL',
      provider: info.provider,
      connected: false,
      host: info.serviceHost,
      database: info.database,
      tables: [],
      error: 'DATABASE_URL is not configured in .env',
    };
  }

  const conn = await testConnection();
  if (!conn.connected) {
    return {
      service: 'Aiven for PostgreSQL',
      provider: info.provider,
      connected: false,
      host: info.serviceHost,
      database: info.database,
      tables: [],
      error: conn.error || 'Failed to reach PostgreSQL server',
    };
  }

  try {
    // 1. Query PostgreSQL version
    const versionRes = await query<{ version: string }>('SELECT version()');
    const fullVersion = versionRes.rows[0]?.version || '';
    const cleanVersion = fullVersion.split(' on ')[0] || fullVersion;

    // 2. Query database size
    const sizeRes = await query<{ size: string; bytes: string }>(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database())::text as bytes'
    );
    const dbSize = sizeRes.rows[0]?.size || 'N/A';
    const dbBytes = parseInt(sizeRes.rows[0]?.bytes || '0', 10);

    // 3. Query active connection count
    const connRes = await query<{ count: string }>(
      'SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()'
    );
    const activeConnections = parseInt(connRes.rows[0]?.count || '1', 10);

    // 4. Query table metrics
    const tablesRes = await query<{
      table_name: string;
      row_count: string;
      total_size: string;
    }>(
      `SELECT
         relname AS table_name,
         n_live_tup AS row_count,
         pg_size_pretty(pg_total_relation_size(relid)) AS total_size
       FROM pg_stat_user_tables
       ORDER BY relname ASC`
    );

    const tables: AivenTableStats[] = tablesRes.rows.map((r) => ({
      tableName: r.table_name,
      rowCount: parseInt(r.row_count, 10) || 0,
      totalSize: r.total_size,
    }));

    return {
      service: 'Aiven for PostgreSQL (Open Source)',
      provider: info.provider,
      connected: true,
      latencyMs: conn.latencyMs,
      host: info.serviceHost,
      database: info.database,
      version: cleanVersion,
      databaseSize: dbSize,
      databaseBytes: dbBytes,
      activeConnections,
      tables,
      serverTime: conn.serverTime,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      service: 'Aiven for PostgreSQL',
      provider: info.provider,
      connected: true,
      latencyMs: conn.latencyMs,
      host: info.serviceHost,
      database: info.database,
      tables: [],
      error: `Diagnostics query error: ${errorMsg}`,
    };
  }
}
