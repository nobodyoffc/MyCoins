import {
  KeyEntry,
  KeystoreManager,
  StorageBackend,
  encryptKeyEntry,
  decryptKeyEntry,
} from '../../src/account/keystore';
import {createAccount} from '../../src/account/account';
import {generateRandomPrivateKey, getPublicKey} from '../../src/crypto/keys';
import {privateKeyToAddresses} from '../../src/crypto/address';
import {CoinType} from '../../src/coins/types';
import {bytesToHex} from '../../src/crypto/encoding';

// In-memory storage backend for testing
class MemoryStorage implements StorageBackend {
  private store: Map<string, string> = new Map();

  async read(path: string): Promise<string | null> {
    return this.store.get(path) || null;
  }

  async write(path: string, data: string): Promise<void> {
    this.store.set(path, data);
  }

  async exists(path: string): Promise<boolean> {
    return this.store.has(path);
  }

  async delete(path: string): Promise<void> {
    this.store.delete(path);
  }

  async listFiles(directory: string): Promise<string[]> {
    const prefix = directory + '/';
    return Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }
}

function createTestKeyEntry(): KeyEntry {
  const privKey = generateRandomPrivateKey();
  const pubKey = getPublicKey(privKey, true);
  const addresses = privateKeyToAddresses(privKey);
  return {
    id: addresses[CoinType.FCH],
    privateKey: privKey,
    publicKey: pubKey,
    isWatchOnly: false,
    addresses,
  };
}

describe('keystore', () => {
  const account = createAccount('test-password');

  test('encrypt and decrypt key entry round-trip', () => {
    const entry = createTestKeyEntry();
    const encrypted = encryptKeyEntry(entry, account.symkey);

    expect(encrypted.id).toBe(entry.id);
    expect(encrypted.isWatchOnly).toBe(false);
    expect(encrypted.iv.length).toBeGreaterThan(0);
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);

    const decrypted = decryptKeyEntry(encrypted, account.symkey);
    expect(decrypted.id).toBe(entry.id);
    expect(decrypted.isWatchOnly).toBe(false);
    expect(bytesToHex(decrypted.privateKey!)).toBe(
      bytesToHex(entry.privateKey!),
    );
    expect(bytesToHex(decrypted.publicKey)).toBe(bytesToHex(entry.publicKey));
  });

  test('encrypt watch-only entry (no private key)', () => {
    const entry = createTestKeyEntry();
    entry.isWatchOnly = true;
    entry.privateKey = null;

    const encrypted = encryptKeyEntry(entry, account.symkey);
    expect(encrypted.ciphertext).toBe('');
    expect(encrypted.iv).toBe('');

    const decrypted = decryptKeyEntry(encrypted, account.symkey);
    expect(decrypted.privateKey).toBeNull();
    expect(decrypted.isWatchOnly).toBe(true);
  });

  test('wrong password fails to decrypt', () => {
    const entry = createTestKeyEntry();
    const encrypted = encryptKeyEntry(entry, account.symkey);

    const wrongAccount = createAccount('wrong-password');
    expect(() =>
      decryptKeyEntry(encrypted, wrongAccount.symkey),
    ).toThrow();
  });
});

describe('KeystoreManager', () => {
  let storage: MemoryStorage;
  let manager: KeystoreManager;
  const account = createAccount('test-password');

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new KeystoreManager(storage);
  });

  test('save and load keys', async () => {
    const entry = createTestKeyEntry();
    await manager.save(account.id, [entry], account.symkey);

    const loaded = await manager.load(account.id, account.symkey);
    expect(loaded.keys.length).toBe(1);
    expect(loaded.keys[0].id).toBe(entry.id);
    expect(bytesToHex(loaded.keys[0].privateKey!)).toBe(
      bytesToHex(entry.privateKey!),
    );
  });

  test('load returns empty keys for non-existent account', async () => {
    const loaded = await manager.load('nonexistent', account.symkey);
    expect(loaded.keys).toEqual([]);
    expect(loaded.activeKeyId).toBeNull();
  });

  test('save and load persists activeKeyId', async () => {
    const entries = [createTestKeyEntry(), createTestKeyEntry()];
    await manager.save(account.id, entries, account.symkey, entries[1].id);

    const loaded = await manager.load(account.id, account.symkey);
    expect(loaded.activeKeyId).toBe(entries[1].id);
  });

  test('exists check', async () => {
    expect(await manager.exists(account.id)).toBe(false);

    const entry = createTestKeyEntry();
    await manager.save(account.id, [entry], account.symkey);

    expect(await manager.exists(account.id)).toBe(true);
  });

  test('delete keystore', async () => {
    const entry = createTestKeyEntry();
    await manager.save(account.id, [entry], account.symkey);
    expect(await manager.exists(account.id)).toBe(true);

    await manager.delete(account.id);
    expect(await manager.exists(account.id)).toBe(false);
  });

  test('list accounts', async () => {
    const account1 = createAccount('password1');
    const account2 = createAccount('password2');
    const entry = createTestKeyEntry();

    await manager.save(account1.id, [entry], account1.symkey);
    await manager.save(account2.id, [entry], account2.symkey);

    const accounts = await manager.listAccounts();
    expect(accounts.length).toBe(2);
    expect(accounts).toContain(account1.id);
    expect(accounts).toContain(account2.id);
  });

  test('multiple keys in one account', async () => {
    const entries = [createTestKeyEntry(), createTestKeyEntry()];
    await manager.save(account.id, entries, account.symkey);

    const loaded = await manager.load(account.id, account.symkey);
    expect(loaded.keys.length).toBe(2);
    expect(loaded.keys[0].id).toBe(entries[0].id);
    expect(loaded.keys[1].id).toBe(entries[1].id);
  });
});
