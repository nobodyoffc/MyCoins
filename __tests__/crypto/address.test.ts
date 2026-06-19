import {
  CoinType,
  pubKeyToAddress,
  privateKeyToAddresses,
} from '../../src/crypto/address';
import {privateKeyFromHex, getPublicKey} from '../../src/crypto/keys';
import {bytesToHex} from '../../src/crypto/encoding';

describe('address derivation', () => {
  // Well-known test vector:
  // Private key: 0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d
  // This is the Bitcoin wiki example key
  const privKeyHex =
    '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d';
  const privKey = privateKeyFromHex(privKeyHex);
  const compressedPubKey = getPublicKey(privKey, true);

  test('BTC address starts with 1', () => {
    const addr = pubKeyToAddress(compressedPubKey, CoinType.BTC);
    expect(addr[0]).toBe('1');
    expect(addr.length).toBeGreaterThanOrEqual(25);
    expect(addr.length).toBeLessThanOrEqual(34);
  });

  test('FCH address starts with F', () => {
    const addr = pubKeyToAddress(compressedPubKey, CoinType.FCH);
    expect(addr[0]).toBe('F');
  });

  test('DOGE address starts with D', () => {
    const addr = pubKeyToAddress(compressedPubKey, CoinType.DOGE);
    expect(addr[0]).toBe('D');
  });

  test('BCH CashAddr starts with bitcoincash:', () => {
    const addr = pubKeyToAddress(compressedPubKey, CoinType.BCH);
    expect(addr.startsWith('bitcoincash:')).toBe(true);
  });

  test('ETH address starts with 0x and is 42 chars', () => {
    const addr = pubKeyToAddress(compressedPubKey, CoinType.ETH);
    expect(addr.startsWith('0x')).toBe(true);
    expect(addr.length).toBe(42);
  });

  test('USDT address equals ETH address', () => {
    const ethAddr = pubKeyToAddress(compressedPubKey, CoinType.ETH);
    const usdtAddr = pubKeyToAddress(compressedPubKey, CoinType.USDT);
    expect(usdtAddr).toBe(ethAddr);
  });

  test('USDC address equals ETH address', () => {
    const ethAddr = pubKeyToAddress(compressedPubKey, CoinType.ETH);
    const usdcAddr = pubKeyToAddress(compressedPubKey, CoinType.USDC);
    expect(usdcAddr).toBe(ethAddr);
  });

  test('privateKeyToAddresses returns all coin types', () => {
    const addrs = privateKeyToAddresses(privKey);
    expect(Object.keys(addrs).length).toBe(7);
    expect(addrs.BTC[0]).toBe('1');
    expect(addrs.FCH[0]).toBe('F');
    expect(addrs.DOGE[0]).toBe('D');
    expect(addrs.BCH.startsWith('bitcoincash:')).toBe(true);
    expect(addrs.ETH.startsWith('0x')).toBe(true);
    expect(addrs.USDT).toBe(addrs.ETH);
    expect(addrs.USDC).toBe(addrs.ETH);
  });

  test('different private keys produce different addresses', () => {
    const privKey2 = privateKeyFromHex(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );
    const addrs1 = privateKeyToAddresses(privKey);
    const addrs2 = privateKeyToAddresses(privKey2);
    expect(addrs1.BTC).not.toBe(addrs2.BTC);
    expect(addrs1.ETH).not.toBe(addrs2.ETH);
    expect(addrs1.FCH).not.toBe(addrs2.FCH);
  });

  // Cross-verify ETH address with a known vector
  // Private key: 0x0000000000000000000000000000000000000000000000000000000000000001
  // Expected ETH address: 0x7e5f4552091a69125d5dfcb7b8c2659029395bdf
  test('ETH address known vector (privkey = 1)', () => {
    const privKey1 = privateKeyFromHex(
      '0000000000000000000000000000000000000000000000000000000000000001',
    );
    const pubKey1 = getPublicKey(privKey1, true);
    const ethAddr = pubKeyToAddress(pubKey1, CoinType.ETH);
    expect(ethAddr.toLowerCase()).toBe(
      '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
    );
  });
});
