import {KeyManager} from '../../src/account/key-manager';
import {KeystoreManager, StorageBackend} from '../../src/account/keystore';
import {createAccount} from '../../src/account/account';
import {generateRandomPrivateKey, getPublicKey} from '../../src/crypto/keys';
import {bytesToHex, encodeWIF} from '../../src/crypto/encoding';

class MemoryStorage implements StorageBackend {
  private store: Map<string, string> = new Map();
  async read(path: string) {
    return this.store.get(path) || null;
  }
  async write(path: string, data: string) {
    this.store.set(path, data);
  }
  async exists(path: string) {
    return this.store.has(path);
  }
  async delete(path: string) {
    this.store.delete(path);
  }
  async listFiles(directory: string) {
    const prefix = directory + '/';
    return Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }
}

describe('KeyManager', () => {
  let keyManager: KeyManager;
  const account = createAccount('test-password');

  beforeEach(async () => {
    const storage = new MemoryStorage();
    const keystoreManager = new KeystoreManager(storage);
    keyManager = new KeyManager(keystoreManager);
    await keyManager.loadAccount(account);
  });

  afterEach(() => {
    keyManager.clear();
  });

  test('addRandomKey generates and stores a key', async () => {
    const entry = await keyManager.addRandomKey();
    expect(entry.id).toBeTruthy();
    expect(entry.id[0]).toBe('F'); // FCH address
    expect(entry.privateKey).toBeTruthy();
    expect(entry.isWatchOnly).toBe(false);
    expect(entry.addresses.BTC[0]).toBe('1');
    expect(entry.addresses.ETH.startsWith('0x')).toBe(true);
  });

  test('listKeys returns all keys', async () => {
    await keyManager.addRandomKey();
    await keyManager.addRandomKey();
    const keys = keyManager.listKeys();
    expect(keys.length).toBe(2);
  });

  test('getActiveKey returns first key by default', async () => {
    const entry = await keyManager.addRandomKey();
    const active = keyManager.getActiveKey();
    expect(active?.id).toBe(entry.id);
  });

  test('setActiveKey changes active key', async () => {
    const entry1 = await keyManager.addRandomKey();
    const entry2 = await keyManager.addRandomKey();
    expect(keyManager.getActiveKey()?.id).toBe(entry1.id);

    await keyManager.setActiveKey(entry2.id);
    expect(keyManager.getActiveKey()?.id).toBe(entry2.id);
  });

  test('importKeyHex imports a hex private key', async () => {
    const privKey = generateRandomPrivateKey();
    const hex = bytesToHex(privKey);
    const entry = await keyManager.importKeyHex(hex);
    expect(bytesToHex(entry.privateKey!)).toBe(hex);
  });

  test('importKeyWIF imports a WIF private key', async () => {
    const privKey = generateRandomPrivateKey();
    const wif = encodeWIF(privKey, true);
    const entry = await keyManager.importKeyWIF(wif);
    expect(bytesToHex(entry.privateKey!)).toBe(bytesToHex(privKey));
  });

  test('importKeyFromSecret imports from secret string', async () => {
    const entry = await keyManager.importKeyFromSecret('my secret phrase');
    expect(entry.privateKey).toBeTruthy();
    expect(entry.id[0]).toBe('F');
  });

  test('importPublicKey creates watch-only entry', async () => {
    const privKey = generateRandomPrivateKey();
    const pubKey = getPublicKey(privKey, true);
    const entry = await keyManager.importPublicKey(bytesToHex(pubKey));
    expect(entry.isWatchOnly).toBe(true);
    expect(entry.privateKey).toBeNull();
    expect(entry.id[0]).toBe('F');
  });

  test('duplicate key import throws', async () => {
    const privKey = generateRandomPrivateKey();
    const hex = bytesToHex(privKey);
    await keyManager.importKeyHex(hex);
    await expect(keyManager.importKeyHex(hex)).rejects.toThrow(
      'Key already exists',
    );
  });

  test('removeKey removes a key', async () => {
    const entry = await keyManager.addRandomKey();
    expect(keyManager.listKeys().length).toBe(1);

    await keyManager.removeKey(entry.id);
    expect(keyManager.listKeys().length).toBe(0);
    expect(keyManager.getActiveKey()).toBeNull();
  });

  test('keys persist across reload', async () => {
    const storage = new MemoryStorage();
    const keystoreManager = new KeystoreManager(storage);

    // First session: create keys
    const km1 = new KeyManager(keystoreManager);
    await km1.loadAccount(account);
    const entry = await km1.addRandomKey();
    const entryId = entry.id;
    const entryPrivKeyHex = bytesToHex(entry.privateKey!);
    km1.clear();

    // Second session: reload
    const km2 = new KeyManager(keystoreManager);
    await km2.loadAccount(account);
    const keys = km2.listKeys();
    expect(keys.length).toBe(1);
    expect(keys[0].id).toBe(entryId);
    expect(bytesToHex(keys[0].privateKey!)).toBe(entryPrivKeyHex);
    km2.clear();
  });

  test('clear wipes private keys from memory', async () => {
    const entry = await keyManager.addRandomKey();
    const privKeyRef = entry.privateKey!;
    keyManager.clear();
    // After clear, the private key bytes should be zeroed
    expect(privKeyRef.every(b => b === 0)).toBe(true);
  });
});
