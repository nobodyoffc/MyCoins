import {sha256, doubleSha256, ripemd160, hash160, keccak256} from '../../src/crypto/hash';
import {hexToBytes, bytesToHex} from '../../src/crypto/encoding';

describe('hash', () => {
  test('sha256 of empty string', () => {
    const result = sha256(new Uint8Array(0));
    expect(bytesToHex(result)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  test('sha256 of "abc"', () => {
    const result = sha256(new TextEncoder().encode('abc'));
    expect(bytesToHex(result)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  test('doubleSha256', () => {
    const result = doubleSha256(new TextEncoder().encode('abc'));
    // sha256(sha256("abc"))
    const expected = sha256(sha256(new TextEncoder().encode('abc')));
    expect(bytesToHex(result)).toBe(bytesToHex(expected));
  });

  test('ripemd160 of empty', () => {
    const result = ripemd160(new Uint8Array(0));
    expect(bytesToHex(result)).toBe(
      '9c1185a5c5e9fc54612808977ee8f548b2258d31',
    );
  });

  test('hash160 (ripemd160(sha256(x)))', () => {
    const input = new TextEncoder().encode('test');
    const expected = ripemd160(sha256(input));
    expect(bytesToHex(hash160(input))).toBe(bytesToHex(expected));
  });

  test('keccak256 of empty', () => {
    const result = keccak256(new Uint8Array(0));
    expect(bytesToHex(result)).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
  });
});
