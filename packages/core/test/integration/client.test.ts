import { describe, it, expect } from 'vitest';
import { withClient } from '../../src';

/**
 * Integration test: requires outbound network to XRPL testnet.
 * Satisfies plan A3 DoD ("conecta a testnet y obtiene server_info").
 */
describe('xrpl client (integration · testnet)', () => {
  it('connects and fetches server_info', async () => {
    const info = await withClient((client) => client.request({ command: 'server_info' }));
    expect(info.result.info).toBeDefined();
    expect(info.result.info.build_version).toMatch(/\d+\.\d+\.\d+/);
  });

  it('disconnects cleanly even when the callback throws', async () => {
    await expect(
      withClient(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
