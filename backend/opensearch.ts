import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@opensearch-project/opensearch';
import type { ClientOptions } from '@opensearch-project/opensearch';
import dotenv from 'dotenv';

// Load both root .env and backend/.env so variables are accessible regardless of working directory
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

export interface OpenSearchHealthStatus {
  status: 'connected' | 'disconnected' | 'unconfigured';
  connected: boolean;
  clusterName?: string;
  clusterHealth?: 'green' | 'yellow' | 'red';
  latencyMs?: number;
  numberOfNodes?: number;
  numberOfDataNodes?: number;
  activePrimaryShards?: number;
  activeShards?: number;
  unassignedShards?: number;
  nodeUrl?: string;
  error?: string;
}

let clientInstance: Client | null = null;

/**
 * Resolves the CA certificate from OPENSEARCH_CA.
 * Can be either a path to a certificate file, or a PEM-encoded certificate string.
 */
function resolveCaCertificate(): Buffer | string | undefined {
  const rawCa = process.env.OPENSEARCH_CA?.trim();
  if (!rawCa) return undefined;

  // Check if it is a relative or absolute file path
  const candidatePath = path.isAbsolute(rawCa)
    ? rawCa
    : path.resolve(process.cwd(), rawCa);

  if (fs.existsSync(candidatePath)) {
    try {
      return fs.readFileSync(candidatePath);
    } catch (err: unknown) {
      console.warn('[OpenSearch] Warning: Failed to read CA file at path:', candidatePath, err);
    }
  }

  // Also check relative to backend directory if not found in cwd
  const backendCandidatePath = path.resolve(__dirname, rawCa);
  if (fs.existsSync(backendCandidatePath)) {
    try {
      return fs.readFileSync(backendCandidatePath);
    } catch (err: unknown) {
      console.warn('[OpenSearch] Warning: Failed to read CA file at path:', backendCandidatePath, err);
    }
  }

  // Treat as inline PEM string (handle escaped newlines)
  if (rawCa.includes('BEGIN CERTIFICATE')) {
    return Buffer.from(rawCa.replace(/\\n/g, '\n'), 'utf8');
  }

  return rawCa;
}

/**
 * Checks if OpenSearch connection parameters are configured.
 */
export function isOpenSearchConfigured(): boolean {
  return Boolean(process.env.OPENSEARCH_URL?.trim());
}

/**
 * Builds the OpenSearch Client configuration with strict HTTPS and CA verification.
 * Note: SSL certificate verification is ALWAYS strictly enforced (rejectUnauthorized: true).
 */
export function buildOpenSearchConfig(): ClientOptions {
  const nodeUrl = process.env.OPENSEARCH_URL?.trim();
  if (!nodeUrl) {
    throw new Error('OPENSEARCH_URL is not defined in environment variables.');
  }

  const username = process.env.OPENSEARCH_USERNAME?.trim();
  const password = process.env.OPENSEARCH_PASSWORD?.trim();
  const ca = resolveCaCertificate();

  const sslConfig: { ca?: Buffer | string; rejectUnauthorized: true } = {
    // Explicitly enforce CA verification - NEVER disable certificate verification
    rejectUnauthorized: true,
  };

  if (ca) {
    sslConfig.ca = ca;
  }

  const clientOptions: ClientOptions = {
    node: nodeUrl,
    ssl: sslConfig,
    requestTimeout: 10000,
    maxRetries: 3,
  };

  if (username && password) {
    clientOptions.auth = {
      username,
      password,
    };
  }

  return clientOptions;
}

/**
 * Returns a singleton instance of the OpenSearch client.
 */
export function getOpenSearchClient(): Client {
  if (!clientInstance) {
    const config = buildOpenSearchConfig();
    clientInstance = new Client(config);
  }
  return clientInstance;
}

/**
 * Tests the OpenSearch connection using client.cluster.health().
 */
export async function testOpenSearchConnection(): Promise<{
  connected: boolean;
  clusterHealth?: Record<string, unknown>;
  latencyMs?: number;
  error?: string;
}> {
  if (!isOpenSearchConfigured()) {
    return {
      connected: false,
      error: 'OpenSearch is not configured. Set OPENSEARCH_URL in your .env file.',
    };
  }

  const start = Date.now();
  try {
    const client = getOpenSearchClient();
    const response = await client.cluster.health();
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      clusterHealth: response.body as Record<string, unknown>,
      latencyMs,
    };
  } catch (err: unknown) {
    const errorMsg = formatOpenSearchError(err);
    return {
      connected: false,
      error: errorMsg,
    };
  }
}

/**
 * Health-check function that returns connection status, cluster name, cluster health, and latency.
 */
export async function getOpenSearchHealth(): Promise<OpenSearchHealthStatus> {
  const nodeUrl = process.env.OPENSEARCH_URL?.trim();

  if (!nodeUrl) {
    return {
      status: 'unconfigured',
      connected: false,
      error: 'OPENSEARCH_URL environment variable is missing or empty.',
    };
  }

  // Mask credentials if present in URL for security
  let sanitizedUrl = nodeUrl;
  try {
    const parsed = new URL(nodeUrl);
    if (parsed.password) {
      parsed.password = '*****';
    }
    sanitizedUrl = parsed.toString();
  } catch {
    // Keep sanitizedUrl as is if not a valid URL
  }

  const start = Date.now();
  try {
    const client = getOpenSearchClient();
    const response = await client.cluster.health();
    const latencyMs = Date.now() - start;
    const body = response.body as {
      cluster_name?: string;
      status?: 'green' | 'yellow' | 'red';
      number_of_nodes?: number;
      number_of_data_nodes?: number;
      active_primary_shards?: number;
      active_shards?: number;
      unassigned_shards?: number;
    };

    return {
      status: 'connected',
      connected: true,
      clusterName: body.cluster_name,
      clusterHealth: body.status,
      latencyMs,
      numberOfNodes: body.number_of_nodes,
      numberOfDataNodes: body.number_of_data_nodes,
      activePrimaryShards: body.active_primary_shards,
      activeShards: body.active_shards,
      unassignedShards: body.unassigned_shards,
      nodeUrl: sanitizedUrl,
    };
  } catch (err: unknown) {
    const errorMsg = formatOpenSearchError(err);
    return {
      status: 'disconnected',
      connected: false,
      nodeUrl: sanitizedUrl,
      error: errorMsg,
    };
  }
}

/**
 * Formats errors into clear, actionable messages.
 */
function formatOpenSearchError(err: unknown): string {
  if (!err) return 'Unknown error occurred.';

  const errorObj = err as Record<string, unknown>;
  const msg = err instanceof Error ? err.message : String(err);
  const code = typeof errorObj.code === 'string' ? errorObj.code : '';

  if (code === 'ENOTFOUND') {
    return `Host not found: could not resolve OpenSearch cluster hostname. Check OPENSEARCH_URL. (${msg})`;
  }
  if (code === 'ECONNREFUSED') {
    return `Connection refused: OpenSearch server is not listening on the specified port. (${msg})`;
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return `Connection timed out: unable to reach OpenSearch cluster within request timeout limit. (${msg})`;
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    msg.includes('certificate') ||
    msg.includes('self-signed')
  ) {
    return `SSL/TLS verification failed: OpenSearch certificate cannot be verified. Provide the Aiven/OpenSearch CA certificate via OPENSEARCH_CA. (${msg})`;
  }
  if (
    errorObj.statusCode === 401 ||
    msg.includes('Unauthorized') ||
    msg.includes('401')
  ) {
    return `Authentication failed (401 Unauthorized): Check OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD. (${msg})`;
  }
  if (
    errorObj.statusCode === 403 ||
    msg.includes('Forbidden') ||
    msg.includes('403')
  ) {
    return `Access denied (403 Forbidden): User lacks permissions for cluster health monitoring. (${msg})`;
  }

  return msg;
}

/**
 * Closes the OpenSearch client instance.
 */
export async function closeOpenSearchClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
}

// CLI Execution handler for npm run opensearch:status
if (process.argv[1] && (process.argv[1].endsWith('opensearch.ts') || process.argv[1].endsWith('opensearch.js'))) {
  console.log('[OpenSearch] Checking OpenSearch cluster health & connectivity...');

  getOpenSearchHealth()
    .then((health) => {
      console.log('----------------------------------------------------');
      console.log(`Connection Status : ${health.connected ? 'SUCCESS (Connected)' : 'FAILED (' + health.status + ')'}`);
      if (health.nodeUrl) console.log(`Endpoint          : ${health.nodeUrl}`);
      if (health.clusterName) console.log(`Cluster Name      : ${health.clusterName}`);
      if (health.clusterHealth) console.log(`Cluster Health    : ${health.clusterHealth.toUpperCase()}`);
      if (health.latencyMs !== undefined) console.log(`Latency           : ${health.latencyMs} ms`);
      if (health.numberOfNodes !== undefined) console.log(`Total Nodes       : ${health.numberOfNodes}`);
      if (health.activeShards !== undefined) console.log(`Active Shards     : ${health.activeShards}`);
      if (health.error) console.log(`Error Detail      : ${health.error}`);
      console.log('----------------------------------------------------');

      return closeOpenSearchClient().then(() => {
        if (!health.connected) {
          process.exit(1);
        }
      });
    })
    .catch((err) => {
      console.error('[OpenSearch] Unexpected error running health-check:', err);
      process.exit(1);
    });
}
