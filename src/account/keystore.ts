import {CoinType} from '../coins/types';
import {encryptToHex, decryptFromHex} from '../crypto/aes';
import {bytesToHex, hexToBytes} from '../crypto/encoding';

export interface KeyEntry {
  id: string; // FCH address
  privateKey: Uint8Array | null; // null for watch-only
  publicKey: Uint8Array;
  isWatchOnly: boolean;
  addresses: Record<CoinType, string>;
  /** True once the user has confirmed they saved this prikey somewhere safe. */
  backedUp: boolean;
}

export interface EncryptedKeyEntry {
  id: string;
  iv: string;
  ciphertext: string;
  publicKey: string; // hex-encoded (always stored unencrypted)
  isWatchOnly: boolean;
  addresses: Record<CoinType, string>;
  backedUp?: boolean; // absent in keystores written before backup tracking
}

export interface KeystoreFile {
  accountId: string;
  version: number;
  keys: EncryptedKeyEntry[];
  activeKeyId?: string | null; // id of the key last used; restored on relaunch
}

export interface StorageBackend {
  read(path: string): Promise<string | null>;
  write(path: string, data: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  listFiles(directory: string): Promise<string[]>;
}

const KEYSTORE_VERSION = 1;

export function encryptKeyEntry(
  entry: KeyEntry,
  symkey: Uint8Array,
): EncryptedKeyEntry {
  let iv = '';
  let ciphertext = '';

  if (!entry.isWatchOnly && entry.privateKey) {
    const encrypted = encryptToHex(entry.privateKey, symkey);
    iv = encrypted.iv;
    ciphertext = encrypted.ciphertext;
  }

  return {
    id: entry.id,
    iv,
    ciphertext,
    publicKey: bytesToHex(entry.publicKey),
    isWatchOnly: entry.isWatchOnly,
    addresses: entry.addresses,
    backedUp: entry.backedUp,
  };
}

export function decryptKeyEntry(
  encrypted: EncryptedKeyEntry,
  symkey: Uint8Array,
): KeyEntry {
  let privateKey: Uint8Array | null = null;

  if (!encrypted.isWatchOnly && encrypted.ciphertext) {
    privateKey = decryptFromHex(
      encrypted.iv,
      encrypted.ciphertext,
      symkey,
    );
  }

  return {
    id: encrypted.id,
    privateKey,
    publicKey: hexToBytes(encrypted.publicKey),
    isWatchOnly: encrypted.isWatchOnly,
    addresses: encrypted.addresses,
    // Watch-only keys hold no secret, so there is nothing to back up.
    backedUp: encrypted.backedUp ?? encrypted.isWatchOnly,
  };
}

export function createKeystoreFile(
  accountId: string,
  keys: KeyEntry[],
  symkey: Uint8Array,
  activeKeyId: string | null = null,
): KeystoreFile {
  return {
    accountId,
    version: KEYSTORE_VERSION,
    keys: keys.map(k => encryptKeyEntry(k, symkey)),
    activeKeyId,
  };
}

export function decryptKeystoreFile(
  keystore: KeystoreFile,
  symkey: Uint8Array,
): KeyEntry[] {
  return keystore.keys.map(k => decryptKeyEntry(k, symkey));
}

export class KeystoreManager {
  private storage: StorageBackend;
  private basePath: string;

  constructor(storage: StorageBackend, basePath: string = 'keystores') {
    this.storage = storage;
    this.basePath = basePath;
  }

  private keystorePath(accountId: string): string {
    return `${this.basePath}/${accountId}.json`;
  }

  async save(
    accountId: string,
    keys: KeyEntry[],
    symkey: Uint8Array,
    activeKeyId: string | null = null,
  ): Promise<void> {
    const keystore = createKeystoreFile(accountId, keys, symkey, activeKeyId);
    const json = JSON.stringify(keystore, null, 2);
    await this.storage.write(this.keystorePath(accountId), json);
  }

  async load(
    accountId: string,
    symkey: Uint8Array,
  ): Promise<{keys: KeyEntry[]; activeKeyId: string | null}> {
    const json = await this.storage.read(this.keystorePath(accountId));
    if (!json) {
      return {keys: [], activeKeyId: null};
    }
    const keystore: KeystoreFile = JSON.parse(json);
    if (keystore.version !== KEYSTORE_VERSION) {
      throw new Error(`Unsupported keystore version: ${keystore.version}`);
    }
    return {
      keys: decryptKeystoreFile(keystore, symkey),
      activeKeyId: keystore.activeKeyId ?? null,
    };
  }

  async exists(accountId: string): Promise<boolean> {
    return this.storage.exists(this.keystorePath(accountId));
  }

  async delete(accountId: string): Promise<void> {
    return this.storage.delete(this.keystorePath(accountId));
  }

  async listAccounts(): Promise<string[]> {
    const files = await this.storage.listFiles(this.basePath);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }
}
