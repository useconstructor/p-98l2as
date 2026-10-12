import 'server-only';
import { createClient, type Client } from '@libsql/client';

let client: Client | undefined;

// Next imports route modules during builds, before runtime credentials exist.
// Resolve credentials only when a server request actually uses the database.
export function getDb(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !/^libsql:\/\//.test(url) || !authToken) {
    throw new Error('Turso runtime configuration is missing: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  }
  client = createClient({ url, authToken });
  return client;
}
