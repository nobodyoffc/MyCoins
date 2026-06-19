import * as secp from '@noble/secp256k1';
import {encodeRLP, bigintToRLPBytes, numberToRLPBytes} from '../../src/coins/eth/rlp';
import {signEthTransaction, buildEthTransfer} from '../../src/coins/eth/tx-builder';
import {encodeTransferData, buildErc20Transfer} from '../../src/coins/erc20/tx-builder';
import {privateKeyFromHex} from '../../src/crypto/keys';
import {privateKeyToAddresses} from '../../src/crypto/address';
import {CoinType} from '../../src/coins/types';
import {keccak256} from '../../src/crypto/hash';
import {bytesToHex, hexToBytes} from '../../src/crypto/encoding';

// Minimal RLP decoder — just enough to split a signed EIP-1559 tx into its items.
function decodeRLPList(bytes: Uint8Array): Uint8Array[] {
  // Assumes a top-level list; returns each item's raw payload bytes.
  let p = bytes[0] >= 0xf8 ? 1 + (bytes[0] - 0xf7) : 1; // skip list header
  const items: Uint8Array[] = [];
  while (p < bytes.length) {
    const b = bytes[p];
    if (b < 0x80) {
      items.push(bytes.slice(p, p + 1));
      p += 1;
    } else if (b < 0xb8) {
      const len = b - 0x80;
      items.push(bytes.slice(p + 1, p + 1 + len));
      p += 1 + len;
    } else if (b < 0xc0) {
      const lenOfLen = b - 0xb7;
      let len = 0;
      for (let i = 0; i < lenOfLen; i++) len = len * 256 + bytes[p + 1 + i];
      items.push(bytes.slice(p + 1 + lenOfLen, p + 1 + lenOfLen + len));
      p += 1 + lenOfLen + len;
    } else {
      // nested list (accessList) — capture whole sub-structure as one item
      const lenOfLen = b >= 0xf8 ? b - 0xf7 : 0;
      let len = b >= 0xf8 ? 0 : b - 0xc0;
      for (let i = 0; i < lenOfLen; i++) len = len * 256 + bytes[p + 1 + i];
      const headerLen = 1 + lenOfLen;
      items.push(bytes.slice(p, p + headerLen + len));
      p += headerLen + len;
    }
  }
  return items;
}

// Recover the 0x-prefixed sender address from a signed EIP-1559 raw tx.
function recoverSender(rawHex: string): string {
  const raw = hexToBytes(rawHex.slice(2));
  expect(raw[0]).toBe(0x02);
  const items = decodeRLPList(raw.slice(1));
  // [chainId, nonce, maxPrio, maxFee, gas, to, value, data, accessList, v, r, s]
  const v = items[9].length ? items[9][items[9].length - 1] : 0;
  const r = items[10];
  const s = items[11];
  // Rebuild the unsigned signing payload (first 8 fields + empty accessList).
  // The accessList must be re-encoded as a real empty list ([]), not as the
  // raw 0xc0 byte the decoder captured it as.
  const signingFields = [...items.slice(0, 8), []];
  const rlp = encodeRLP(signingFields);
  const unsigned = new Uint8Array(1 + rlp.length);
  unsigned[0] = 0x02;
  unsigned.set(rlp, 1);
  const msgHash = keccak256(unsigned);
  const sig = new Uint8Array(65);
  sig[0] = v;
  sig.set(r.length === 32 ? r : new Uint8Array([...new Uint8Array(32 - r.length), ...r]), 1);
  sig.set(s.length === 32 ? s : new Uint8Array([...new Uint8Array(32 - s.length), ...s]), 33);
  const pub = secp.recoverPublicKey(sig, msgHash, {prehash: false});
  const uncompressed = secp.Point.fromBytes(pub).toBytes(false);
  return '0x' + bytesToHex(keccak256(uncompressed.slice(1)).slice(12));
}

const TEST_PRIVKEY =
  'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575';

describe('RLP encoding', () => {
  test('encode empty bytes', () => {
    const result = encodeRLP(new Uint8Array(0));
    expect(bytesToHex(result)).toBe('80');
  });

  test('encode single byte < 0x80', () => {
    const result = encodeRLP(new Uint8Array([0x42]));
    expect(bytesToHex(result)).toBe('42');
  });

  test('encode single byte >= 0x80', () => {
    const result = encodeRLP(new Uint8Array([0x80]));
    expect(bytesToHex(result)).toBe('8180');
  });

  test('encode short string', () => {
    // "dog" = 0x646f67
    const result = encodeRLP(new Uint8Array([0x64, 0x6f, 0x67]));
    expect(bytesToHex(result)).toBe('83646f67');
  });

  test('encode empty list', () => {
    const result = encodeRLP([]);
    expect(bytesToHex(result)).toBe('c0');
  });

  test('encode list with items', () => {
    // ["cat", "dog"]
    const result = encodeRLP([
      new Uint8Array([0x63, 0x61, 0x74]),
      new Uint8Array([0x64, 0x6f, 0x67]),
    ]);
    expect(bytesToHex(result)).toBe('c88363617483646f67');
  });

  test('encode integer 0', () => {
    const result = bigintToRLPBytes(0n);
    expect(result.length).toBe(0);
  });

  test('encode integer 1', () => {
    const result = bigintToRLPBytes(1n);
    expect(bytesToHex(result)).toBe('01');
  });

  test('encode integer 1024', () => {
    const result = bigintToRLPBytes(1024n);
    expect(bytesToHex(result)).toBe('0400');
  });

  test('encode large integer', () => {
    const result = bigintToRLPBytes(21000n);
    expect(bytesToHex(result)).toBe('5208');
  });
});

describe('ETH transaction builder', () => {
  test('buildEthTransfer produces valid signed TX', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);

    const result = buildEthTransfer({
      chainId: 1,
      nonce: 0,
      to: '0x76057bbddc7011227cd894436556f74a09fa1a11',
      value: 1000000000000000n, // 0.001 ETH
      maxPriorityFeePerGas: 1500000000n, // 1.5 gwei
      maxFeePerGas: 30000000000n, // 30 gwei
      privateKey: privKey,
    });

    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.rawHex).toMatch(/^0x02/); // EIP-1559 type 2
    expect(result.rawHex.length).toBeGreaterThan(10);
  });

  test('same inputs produce same TX', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const params = {
      chainId: 1,
      nonce: 5,
      to: '0x76057bbddc7011227cd894436556f74a09fa1a11',
      value: 500000000000000000n, // 0.5 ETH
      maxPriorityFeePerGas: 2000000000n,
      maxFeePerGas: 50000000000n,
      privateKey: privKey,
    };

    const result1 = buildEthTransfer(params);
    const result2 = buildEthTransfer(params);
    expect(result1.rawHex).toBe(result2.rawHex);
    expect(result1.txHash).toBe(result2.txHash);
  });

  test('different nonces produce different TXs', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const base = {
      chainId: 1,
      to: '0x76057bbddc7011227cd894436556f74a09fa1a11',
      value: 1000000000000000n,
      maxPriorityFeePerGas: 1500000000n,
      maxFeePerGas: 30000000000n,
      privateKey: privKey,
    };

    const r1 = buildEthTransfer({...base, nonce: 0});
    const r2 = buildEthTransfer({...base, nonce: 1});
    expect(r1.rawHex).not.toBe(r2.rawHex);
  });
});

describe('ERC-20 transfer', () => {
  test('encodeTransferData produces correct ABI encoding', () => {
    const data = encodeTransferData(
      '0x76057bbddc7011227cd894436556f74a09fa1a11',
      1000000n, // 1 USDT/USDC (6 decimals)
    );

    // 4 + 32 + 32 = 68 bytes
    expect(data.length).toBe(68);

    const hex = bytesToHex(data);
    // Function selector: a9059cbb
    expect(hex.substring(0, 8)).toBe('a9059cbb');
    // Address padded to 32 bytes
    expect(hex.substring(8, 72)).toBe(
      '00000000000000000000000076057bbddc7011227cd894436556f74a09fa1a11',
    );
    // Amount: 1000000 = 0xF4240
    expect(hex.substring(72, 136)).toBe(
      '00000000000000000000000000000000000000000000000000000000000f4240',
    );
  });

  test('buildErc20Transfer produces valid signed TX', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);

    const result = buildErc20Transfer({
      chainId: 1,
      nonce: 0,
      contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      toAddress: '0x76057bbddc7011227cd894436556f74a09fa1a11',
      amount: 1000000n, // 1 USDT
      maxPriorityFeePerGas: 1500000000n,
      maxFeePerGas: 30000000000n,
      privateKey: privKey,
    });

    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.rawHex).toMatch(/^0x02/);
  });
});

// Regression for the "Insufficient funds ... have 0" bug: the recovery id (v)
// was hardcoded to 0, so ~half of all signed TXs recovered to a WRONG sender
// address (an empty account), and the node rejected them. The encoded v must
// always recover to the key's real address.
describe('signed TX recovers to correct sender (v / recovery id)', () => {
  const privKey = privateKeyFromHex(TEST_PRIVKEY);
  const expected = privateKeyToAddresses(privKey)[CoinType.ETH].toLowerCase();

  test('native ETH transfer recovers correct sender across many nonces', () => {
    for (let nonce = 0; nonce < 40; nonce++) {
      const {rawHex} = buildEthTransfer({
        chainId: 1,
        nonce,
        to: '0x76057bbddc7011227cd894436556f74a09fa1a11',
        value: 1000000000000000n,
        maxPriorityFeePerGas: 1500000000n,
        maxFeePerGas: 30000000000n,
        privateKey: privKey,
      });
      expect(recoverSender(rawHex)).toBe(expected);
    }
  });

  test('ERC-20 (USDT) transfer recovers correct sender across many nonces', () => {
    for (let nonce = 0; nonce < 40; nonce++) {
      const {rawHex} = buildErc20Transfer({
        chainId: 1,
        nonce,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        toAddress: '0x76057bbddc7011227cd894436556f74a09fa1a11',
        amount: 2000000n, // 2 USDT
        maxPriorityFeePerGas: 1500000000n,
        maxFeePerGas: 30000000000n,
        privateKey: privKey,
      });
      expect(recoverSender(rawHex)).toBe(expected);
    }
  });
});
