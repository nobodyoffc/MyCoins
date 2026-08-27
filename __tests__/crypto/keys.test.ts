import {
  generateRandomPrivateKey,
  isValidPrivateKey,
  privateKeyFromHex,
  privateKeyFromWIF,
  privateKeyFromSecret,
  getPublicKey,
  isValidPublicKey,
  publicKeyFromHex,
} from '../../src/crypto/keys';
import {bytesToHex, utf8ToBytes} from '../../src/crypto/encoding';
import {sha256} from '../../src/crypto/hash';

describe('keys', () => {
  const testPrivKeyHex =
    '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d';

  test('generateRandomPrivateKey returns valid 32-byte key', () => {
    const key = generateRandomPrivateKey();
    expect(key.length).toBe(32);
    expect(isValidPrivateKey(key)).toBe(true);
  });

  test('privateKeyFromHex', () => {
    const key = privateKeyFromHex(testPrivKeyHex);
    expect(bytesToHex(key)).toBe(testPrivKeyHex);
    expect(isValidPrivateKey(key)).toBe(true);
  });

  test('privateKeyFromHex with 0x prefix', () => {
    const key = privateKeyFromHex('0x' + testPrivKeyHex);
    expect(bytesToHex(key)).toBe(testPrivKeyHex);
  });

  test('privateKeyFromHex rejects invalid length', () => {
    expect(() => privateKeyFromHex('aabb')).toThrow('64 characters');
  });

  test('privateKeyFromWIF', () => {
    const wif = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
    const {key, compressed} = privateKeyFromWIF(wif);
    expect(bytesToHex(key)).toBe(testPrivKeyHex);
    expect(compressed).toBe(false);
  });

  test('privateKeyFromSecret with sha256', async () => {
    const key = await privateKeyFromSecret('my secret passphrase', 'sha256');
    expect(key.length).toBe(32);
    expect(isValidPrivateKey(key)).toBe(true);
    // Same input should always produce same key
    const key2 = await privateKeyFromSecret('my secret passphrase', 'sha256');
    expect(bytesToHex(key)).toBe(bytesToHex(key2));
    // sha256 mode is the plain hash of the phrase.
    expect(bytesToHex(key)).toBe(bytesToHex(sha256(utf8ToBytes('my secret passphrase'))));
  });

  test('privateKeyFromSecret defaults to argon2id', async () => {
    const argonKey = await privateKeyFromSecret('my secret passphrase');
    expect(argonKey.length).toBe(32);
    expect(isValidPrivateKey(argonKey)).toBe(true);
    const shaKey = await privateKeyFromSecret('my secret passphrase', 'sha256');
    expect(bytesToHex(argonKey)).not.toBe(bytesToHex(shaKey));
  }, 180000);

  test('getPublicKey compressed', () => {
    const privKey = privateKeyFromHex(testPrivKeyHex);
    const pubKey = getPublicKey(privKey, true);
    expect(pubKey.length).toBe(33);
    expect(pubKey[0] === 0x02 || pubKey[0] === 0x03).toBe(true);
  });

  test('getPublicKey uncompressed', () => {
    const privKey = privateKeyFromHex(testPrivKeyHex);
    const pubKey = getPublicKey(privKey, false);
    expect(pubKey.length).toBe(65);
    expect(pubKey[0]).toBe(0x04);
  });

  test('publicKeyFromHex validates', () => {
    const privKey = privateKeyFromHex(testPrivKeyHex);
    const pubKey = getPublicKey(privKey, true);
    const hex = bytesToHex(pubKey);
    const parsed = publicKeyFromHex(hex);
    expect(bytesToHex(parsed)).toBe(hex);
  });

  test('isValidPublicKey', () => {
    const privKey = privateKeyFromHex(testPrivKeyHex);
    const pubKey = getPublicKey(privKey, true);
    expect(isValidPublicKey(pubKey)).toBe(true);
    expect(isValidPublicKey(new Uint8Array(33))).toBe(false);
  });
});
