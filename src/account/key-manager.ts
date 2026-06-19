import {CoinType} from '../coins/types';
import {
  generateRandomPrivateKey,
  privateKeyFromHex,
  privateKeyFromWIF,
  privateKeyFromSecret,
  getPublicKey,
  publicKeyFromHex,
} from '../crypto/keys';
import {privateKeyToAddresses, publicKeyToAddresses} from '../crypto/address';
import {Account, deriveSymkey} from './account';
import {KeyEntry, KeystoreManager} from './keystore';
import {decryptFromHex} from '../crypto/aes';

export class KeyManager {
  private keystoreManager: KeystoreManager;
  private keys: KeyEntry[] = [];
  private activeKeyId: string | null = null;
  private currentAccount: Account | null = null;

  constructor(keystoreManager: KeystoreManager) {
    this.keystoreManager = keystoreManager;
  }

  async loadAccount(account: Account): Promise<void> {
    this.currentAccount = account;
    const {keys, activeKeyId} = await this.keystoreManager.load(
      account.id,
      account.symkey,
    );
    this.keys = keys;
    // Restore the key last used (if it still exists), otherwise fall back to the first.
    if (activeKeyId && this.keys.some(k => k.id === activeKeyId)) {
      this.activeKeyId = activeKeyId;
    } else if (this.keys.length > 0 && !this.activeKeyId) {
      this.activeKeyId = this.keys[0].id;
    }
  }

  async saveKeys(): Promise<void> {
    if (!this.currentAccount) {
      throw new Error('No account loaded');
    }
    await this.keystoreManager.save(
      this.currentAccount.id,
      this.keys,
      this.currentAccount.symkey,
      this.activeKeyId,
    );
  }

  private createKeyEntry(
    privateKey: Uint8Array,
    compressed: boolean = true,
  ): KeyEntry {
    const pubKey = getPublicKey(privateKey, compressed);
    const addresses = privateKeyToAddresses(privateKey);
    return {
      id: addresses[CoinType.FCH],
      privateKey,
      publicKey: pubKey,
      isWatchOnly: false,
      addresses,
    };
  }

  async addRandomKey(): Promise<KeyEntry> {
    const privKey = generateRandomPrivateKey();
    const entry = this.createKeyEntry(privKey);
    this.keys.push(entry);
    if (!this.activeKeyId) {
      this.activeKeyId = entry.id;
    }
    await this.saveKeys();
    return entry;
  }

  async importKeyHex(hex: string): Promise<KeyEntry> {
    const privKey = privateKeyFromHex(hex);
    const entry = this.createKeyEntry(privKey);
    this.checkDuplicate(entry.id);
    this.keys.push(entry);
    await this.saveKeys();
    return entry;
  }

  async importKeyWIF(wif: string): Promise<KeyEntry> {
    const {key, compressed} = privateKeyFromWIF(wif);
    const entry = this.createKeyEntry(key, compressed);
    this.checkDuplicate(entry.id);
    this.keys.push(entry);
    await this.saveKeys();
    return entry;
  }

  async importKeyFromSecret(secret: string): Promise<KeyEntry> {
    const privKey = privateKeyFromSecret(secret);
    const entry = this.createKeyEntry(privKey);
    this.checkDuplicate(entry.id);
    this.keys.push(entry);
    await this.saveKeys();
    return entry;
  }

  async importPublicKey(pubKeyHex: string): Promise<KeyEntry> {
    const pubKey = publicKeyFromHex(pubKeyHex);
    const addresses = publicKeyToAddresses(pubKey);
    const entry: KeyEntry = {
      id: addresses[CoinType.FCH],
      privateKey: null,
      publicKey: pubKey,
      isWatchOnly: true,
      addresses,
    };
    this.checkDuplicate(entry.id);
    this.keys.push(entry);
    await this.saveKeys();
    return entry;
  }

  async importKeyCipher(cipherJson: string, password: string): Promise<KeyEntry> {
    let parsed: any;
    try {
      parsed = JSON.parse(cipherJson);
    } catch {
      throw new Error('Invalid JSON format');
    }
    if (!parsed.iv || !parsed.cipher) {
      throw new Error('Invalid cipher: missing iv or cipher');
    }
    const encKey = deriveSymkey(password);
    // Decode Base64 cipher to hex for decryptFromHex
    const binary = atob(parsed.cipher);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }
    let ciphertextHex = '';
    for (let i = 0; i < cipherBytes.length; i++) {
      ciphertextHex += cipherBytes[i].toString(16).padStart(2, '0');
    }
    let privKeyBytes: Uint8Array;
    try {
      privKeyBytes = decryptFromHex(parsed.iv, ciphertextHex, encKey);
    } catch {
      throw new Error('Decryption failed — wrong password or corrupted cipher');
    }
    if (privKeyBytes.length !== 32) {
      throw new Error('Decrypted key has invalid length');
    }
    const entry = this.createKeyEntry(privKeyBytes);
    this.checkDuplicate(entry.id);
    this.keys.push(entry);
    await this.saveKeys();
    return entry;
  }

  async removeKey(fchAddress: string): Promise<void> {
    const index = this.keys.findIndex(k => k.id === fchAddress);
    if (index === -1) {
      throw new Error(`Key not found: ${fchAddress}`);
    }
    this.keys.splice(index, 1);
    if (this.activeKeyId === fchAddress) {
      this.activeKeyId = this.keys.length > 0 ? this.keys[0].id : null;
    }
    await this.saveKeys();
  }

  listKeys(): KeyEntry[] {
    return [...this.keys];
  }

  getActiveKey(): KeyEntry | null {
    if (!this.activeKeyId) {
      return null;
    }
    return this.keys.find(k => k.id === this.activeKeyId) || null;
  }

  async setActiveKey(fchAddress: string): Promise<void> {
    const key = this.keys.find(k => k.id === fchAddress);
    if (!key) {
      throw new Error(`Key not found: ${fchAddress}`);
    }
    this.activeKeyId = fchAddress;
    // Persist so the next relaunch restores this key.
    await this.saveKeys();
  }

  clear(): void {
    // Wipe prikeys from memory
    for (const key of this.keys) {
      if (key.privateKey) {
        key.privateKey.fill(0);
      }
    }
    this.keys = [];
    this.activeKeyId = null;
    this.currentAccount = null;
  }

  private checkDuplicate(id: string): void {
    if (this.keys.some(k => k.id === id)) {
      throw new Error(`Key already exists: ${id}`);
    }
  }
}
