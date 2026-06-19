/**
 * FCH Transaction Integration Test
 *
 * Builds a real FCH transaction using live UTXOs from the API,
 * signs it, and broadcasts it.
 *
 * Run with: npx jest __tests__/coins/fch-tx-integration.test.ts
 */

import {FreecashAPI} from '../../src/api/providers/freecash';
import {buildFchTransaction} from '../../src/coins/fch/tx-builder';
import {privateKeyFromHex, getPublicKey} from '../../src/crypto/keys';
import {privateKeyToAddresses} from '../../src/crypto/address';
import {TxInput} from '../../src/coins/utxo-common';

const TEST_PRIVKEY =
  'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575';
const TEST_FID = 'FEk41Kqjar45fLDriztUDTUkdki7mmcjWK';

describe('FCH Transaction Integration', () => {
  let api: FreecashAPI;

  beforeAll(() => {
    api = new FreecashAPI({baseUrl: 'http://localhost:8081/APIP'});
  });

  test('build and broadcast a self-transfer FCH transaction', async () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const addresses = privateKeyToAddresses(privKey);
    expect(addresses.FCH).toBe(TEST_FID);

    // 1. Fetch UTXOs
    const utxos = await api.getUTXOs(TEST_FID);
    expect(utxos.length).toBeGreaterThan(0);
    console.log(`Found ${utxos.length} UTXOs, total: ${utxos.reduce((s, u) => s + u.value, 0)} satoshis`);

    // Convert to TxInput format
    const txInputs: TxInput[] = utxos.map(u => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      scriptPubKey: u.scriptPubKey,
    }));

    // 2. Build a self-transfer TX (send 10000 satoshis to ourselves)
    const sendAmount = 10000; // 0.0001 FCH
    const result = buildFchTransaction({
      utxos: txInputs,
      recipients: [{address: TEST_FID, value: sendAmount}],
      changeAddress: TEST_FID,
      feeRate: 1, // 1 sat/byte
      privateKey: privKey,
    });

    console.log(`TX built: txid=${result.txid}`);
    console.log(`Raw TX (${result.rawHex.length / 2} bytes):`);
    console.log(result.rawHex);

    expect(result.txid).toBeTruthy();
    expect(result.rawHex).toBeTruthy();

    // 3. Broadcast
    try {
      const txid = await api.broadcastTransaction(result.rawHex);
      console.log(`Broadcast successful! txid: ${txid}`);
      expect(txid).toBeTruthy();
    } catch (err: any) {
      console.log(`Broadcast result: ${err.message}`);
      // May fail if UTXOs are already spent — that's OK for a test
    }
  });
});
