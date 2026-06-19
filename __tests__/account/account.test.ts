import {
  createAccount,
  deriveAccountId,
  deriveSymkey,
  verifyPassword,
} from '../../src/account/account';
import {bytesToHex} from '../../src/crypto/encoding';

describe('account', () => {
  const testPassword = 'my-secret-password';

  test('deriveSymkey returns 32 bytes (sha256 of password)', () => {
    const key = deriveSymkey(testPassword);
    expect(key.length).toBe(32);
  });

  test('deriveSymkey is deterministic', () => {
    const key1 = deriveSymkey(testPassword);
    const key2 = deriveSymkey(testPassword);
    expect(bytesToHex(key1)).toBe(bytesToHex(key2));
  });

  test('deriveAccountId returns 12-char hex string', () => {
    const id = deriveAccountId(testPassword);
    expect(id.length).toBe(12);
    expect(/^[0-9a-f]{12}$/.test(id)).toBe(true);
  });

  test('deriveAccountId is deterministic', () => {
    const id1 = deriveAccountId(testPassword);
    const id2 = deriveAccountId(testPassword);
    expect(id1).toBe(id2);
  });

  test('different passwords produce different IDs', () => {
    const id1 = deriveAccountId('password1');
    const id2 = deriveAccountId('password2');
    expect(id1).not.toBe(id2);
  });

  test('createAccount returns correct structure', () => {
    const account = createAccount(testPassword);
    expect(account.id.length).toBe(12);
    expect(account.symkey.length).toBe(32);
    expect(account.id).toBe(deriveAccountId(testPassword));
  });

  test('verifyPassword returns true for correct password', () => {
    const account = createAccount(testPassword);
    expect(verifyPassword(testPassword, account.id)).toBe(true);
  });

  test('verifyPassword returns false for wrong password', () => {
    const account = createAccount(testPassword);
    expect(verifyPassword('wrong-password', account.id)).toBe(false);
  });
});
