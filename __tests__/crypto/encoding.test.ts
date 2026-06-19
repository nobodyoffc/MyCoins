import {
  hexToBytes,
  bytesToHex,
  utf8ToBytes,
  toBase58Check,
  fromBase58Check,
  encodeWIF,
  decodeWIF,
  encodeCashAddr,
  decodeCashAddr,
} from '../../src/crypto/encoding';

describe('hexToBytes / bytesToHex', () => {
  test('round-trip', () => {
    const hex = 'deadbeef0102';
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  test('empty', () => {
    expect(bytesToHex(hexToBytes(''))).toBe('');
  });

  test('odd length throws', () => {
    expect(() => hexToBytes('abc')).toThrow('even length');
  });
});

describe('utf8ToBytes', () => {
  test('ascii', () => {
    const bytes = utf8ToBytes('hello');
    expect(bytesToHex(bytes)).toBe('68656c6c6f');
  });
});

describe('Base58Check', () => {
  test('encode BTC address (version 0x00)', () => {
    // Known hash160 → BTC address
    const hash = hexToBytes('0000000000000000000000000000000000000000');
    const address = toBase58Check(hash, 0x00);
    expect(address).toBe('1111111111111111111114oLvT2');
  });

  test('round-trip', () => {
    const hash = hexToBytes('89abcdefabbaabbaabbaabbaabbaabbaabbaabba');
    const version = 0x23; // FCH
    const encoded = toBase58Check(hash, version);
    const decoded = fromBase58Check(encoded);
    expect(decoded.version).toBe(version);
    expect(bytesToHex(decoded.hash)).toBe(bytesToHex(hash));
  });

  test('FCH address starts with F', () => {
    // Version 0x23 should produce addresses starting with F
    const hash = hexToBytes('89abcdefabbaabbaabbaabbaabbaabbaabbaabba');
    const address = toBase58Check(hash, 0x23);
    expect(address[0]).toBe('F');
  });

  test('DOGE address starts with D', () => {
    const hash = hexToBytes('89abcdefabbaabbaabbaabbaabbaabbaabbaabba');
    const address = toBase58Check(hash, 0x1e);
    expect(address[0]).toBe('D');
  });
});

describe('WIF', () => {
  test('encode/decode compressed WIF round-trip', () => {
    const key = hexToBytes(
      '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d',
    );
    const wif = encodeWIF(key, true);
    expect(wif[0]).toBe('K'); // Compressed WIF starts with K or L
    const decoded = decodeWIF(wif);
    expect(decoded.compressed).toBe(true);
    expect(bytesToHex(decoded.key)).toBe(bytesToHex(key));
  });

  test('encode/decode uncompressed WIF round-trip', () => {
    const key = hexToBytes(
      '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d',
    );
    const wif = encodeWIF(key, false);
    expect(wif[0]).toBe('5'); // Uncompressed WIF starts with 5
    const decoded = decodeWIF(wif);
    expect(decoded.compressed).toBe(false);
    expect(bytesToHex(decoded.key)).toBe(bytesToHex(key));
  });

  // Known test vector from Bitcoin wiki
  test('known WIF vector', () => {
    const wif = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
    const decoded = decodeWIF(wif);
    expect(decoded.compressed).toBe(false);
    expect(bytesToHex(decoded.key)).toBe(
      '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d',
    );
  });
});

describe('CashAddr', () => {
  test('encode/decode round-trip', () => {
    const hash = hexToBytes('89abcdefabbaabbaabbaabbaabbaabbaabbaabba');
    const addr = encodeCashAddr('bitcoincash', hash);
    expect(addr.startsWith('bitcoincash:')).toBe(true);
    const decoded = decodeCashAddr(addr);
    expect(decoded.prefix).toBe('bitcoincash');
    expect(bytesToHex(decoded.hash)).toBe(bytesToHex(hash));
  });
});
