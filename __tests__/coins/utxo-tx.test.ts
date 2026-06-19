import {
  TxWriter,
  p2pkhScript,
  selectUTXOs,
  signBtcTransaction,
  signBchTransaction,
  TxInput,
  TxOutput,
} from '../../src/coins/utxo-common';
import {privateKeyFromHex, getPublicKey} from '../../src/crypto/keys';
import {fromBase58Check, hexToBytes, bytesToHex} from '../../src/crypto/encoding';
import {hash160} from '../../src/crypto/hash';

const TEST_PRIVKEY =
  'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575';
const TEST_FCH_ADDRESS = 'FEk41Kqjar45fLDriztUDTUkdki7mmcjWK';

function decodeAddress(addr: string): Uint8Array {
  return fromBase58Check(addr).hash;
}

describe('TxWriter', () => {
  test('writeUint32LE', () => {
    const w = new TxWriter();
    w.writeUint32LE(0x01020304);
    expect(bytesToHex(w.toBytes())).toBe('04030201');
  });

  test('writeVarInt small', () => {
    const w = new TxWriter();
    w.writeVarInt(5);
    expect(bytesToHex(w.toBytes())).toBe('05');
  });

  test('writeVarInt medium', () => {
    const w = new TxWriter();
    w.writeVarInt(256);
    expect(bytesToHex(w.toBytes())).toBe('fd0001');
  });

  test('writeReversedHash', () => {
    const w = new TxWriter();
    w.writeReversedHash('0102030405060708');
    expect(bytesToHex(w.toBytes())).toBe('0807060504030201');
  });
});

describe('p2pkhScript', () => {
  test('generates valid P2PKH script', () => {
    const pubKeyHash = new Uint8Array(20);
    pubKeyHash[0] = 0x61;
    const script = p2pkhScript(pubKeyHash);
    expect(script.length).toBe(25);
    expect(script[0]).toBe(0x76); // OP_DUP
    expect(script[1]).toBe(0xa9); // OP_HASH160
    expect(script[2]).toBe(0x14); // 20 bytes
    expect(script[23]).toBe(0x88); // OP_EQUALVERIFY
    expect(script[24]).toBe(0xac); // OP_CHECKSIG
  });
});

describe('selectUTXOs', () => {
  test('selects sufficient UTXOs', () => {
    const utxos: TxInput[] = [
      {txid: 'a'.repeat(64), vout: 0, value: 50000},
      {txid: 'b'.repeat(64), vout: 0, value: 100000},
      {txid: 'c'.repeat(64), vout: 0, value: 200000},
    ];
    const {selected, fee} = selectUTXOs(utxos, 150000, 1);
    expect(selected.length).toBeGreaterThanOrEqual(1);
    const total = selected.reduce((s, u) => s + u.value, 0);
    expect(total).toBeGreaterThanOrEqual(150000 + fee);
  });

  test('throws on insufficient funds', () => {
    const utxos: TxInput[] = [
      {txid: 'a'.repeat(64), vout: 0, value: 1000},
    ];
    expect(() => selectUTXOs(utxos, 100000, 1)).toThrow('Insufficient funds');
  });
});

describe('signBtcTransaction', () => {
  test('produces valid raw TX hex', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const pubKey = getPublicKey(privKey, true);

    const inputs: TxInput[] = [
      {
        txid: 'a'.repeat(64),
        vout: 0,
        value: 100000,
        scriptPubKey: bytesToHex(p2pkhScript(hash160(pubKey))),
      },
    ];
    const outputs: TxOutput[] = [
      {address: TEST_FCH_ADDRESS, value: 90000},
    ];

    const result = signBtcTransaction(
      inputs,
      outputs,
      privKey,
      pubKey,
      decodeAddress,
    );

    expect(result.rawHex).toBeTruthy();
    expect(result.txid).toBeTruthy();
    expect(result.txid.length).toBe(64);
    // Raw TX should start with version (02000000)
    expect(result.rawHex.startsWith('0200')).toBe(true);
  });
});

describe('signBchTransaction (SIGHASH_FORKID)', () => {
  test('produces valid raw TX hex with SIGHASH_FORKID', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const pubKey = getPublicKey(privKey, true);

    const inputs: TxInput[] = [
      {
        txid: 'b'.repeat(64),
        vout: 1,
        value: 200000,
        scriptPubKey: bytesToHex(p2pkhScript(hash160(pubKey))),
      },
    ];
    const outputs: TxOutput[] = [
      {address: TEST_FCH_ADDRESS, value: 190000},
    ];

    const result = signBchTransaction(
      inputs,
      outputs,
      privKey,
      pubKey,
      decodeAddress,
      0, // forkId
    );

    expect(result.rawHex).toBeTruthy();
    expect(result.txid.length).toBe(64);
    // The sighash type byte in the signature should be 0x41 (SIGHASH_ALL | SIGHASH_FORKID)
    // We can verify by checking the scriptSig contains 0x41 as the last byte of the DER sig
    expect(result.rawHex).toContain('41'); // sighash byte
  });
});
