/**
 * Integration test for FCH API against local server.
 * Requires http://localhost:8081/APIP to be running.
 *
 * Run with: npx jest __tests__/api/freecash-integration.test.ts
 */

import {FreecashAPI} from '../../src/api/providers/freecash';

const TEST_FID = 'FEk41Kqjar45fLDriztUDTUkdki7mmcjWK';
const TEST_PRIVKEY = 'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575';

describe('FreecashAPI integration', () => {
  let api: FreecashAPI;

  beforeAll(() => {
    api = new FreecashAPI({baseUrl: 'http://localhost:8081/APIP'});
  });

  test('init fetches service info with dealer pubkey', async () => {
    const info = await api.init();
    expect(info.dealer).toBeTruthy();
    expect(info.dealerPubkey).toBeTruthy();
    expect(info.dealerPubkey.length).toBe(66); // 33 bytes hex
  });

  test('getBalance returns non-zero for test FID', async () => {
    const balance = await api.getBalance(TEST_FID);
    expect(Number(balance)).toBeGreaterThan(0);
  });

  test('getUTXOs returns UTXOs for test FID', async () => {
    const utxos = await api.getUTXOs(TEST_FID);
    expect(utxos.length).toBeGreaterThan(0);
    expect(utxos[0].txid).toBeTruthy();
    expect(utxos[0].value).toBeGreaterThan(0);
  });

  test('getBestBlock returns current block', async () => {
    const block = await api.getBestBlock();
    expect(block).toBeTruthy();
  });

  test('getFreerByIds returns identity info', async () => {
    const freers = await api.getFreerByIds([TEST_FID]);
    expect(freers).toBeTruthy();
  });
});
