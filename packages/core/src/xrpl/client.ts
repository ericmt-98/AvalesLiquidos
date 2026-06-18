import { Client } from 'xrpl';
import { config } from '../config';

/**
 * Create an XRPL client. The caller owns its lifecycle (connect/disconnect).
 * xrpl.js reconnects the underlying websocket automatically on transient drops.
 */
export function createClient(wss: string = config.xrpl.wss): Client {
  return new Client(wss);
}

/**
 * Connect, run `fn` with a live client, and always disconnect afterwards —
 * even if `fn` throws. Convenient for one-shot requests and tests.
 */
export async function withClient<T>(
  fn: (client: Client) => Promise<T>,
  wss?: string,
): Promise<T> {
  const client = createClient(wss);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}
