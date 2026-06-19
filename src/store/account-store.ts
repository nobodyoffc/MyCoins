import {create} from 'zustand';
import {Account, createAccount, verifyPassword} from '../account/account';
import {KeyEntry, KeystoreManager} from '../account/keystore';
import {KeyManager} from '../account/key-manager';
import {CoinType} from '../coins/types';
import {bytesToHex} from '../crypto/encoding';
import {getFCHCommonApi, getFCHLegacyApi} from '../api/api-registry';

async function setupFchApiKeys(key: KeyEntry) {
  try {
    const commonApi = getFCHCommonApi();
    if (key.privateKey) {
      const privHex = bytesToHex(key.privateKey);
      // Timeout after 5 seconds — don't block login if FCH server is down
      await Promise.race([
        commonApi.init(privHex),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('FCH API timeout')), 5000),
        ),
      ]);
      // Also set client key on legacy API so encrypted POST works for serviceSearch
      const legacyApi = getFCHLegacyApi();
      legacyApi.setClientKey(privHex, key.addresses[CoinType.FCH] || '');
    }
  } catch (e: any) {
    console.warn('[setupFchApiKeys] FCH API not available:', e.message);
    // Login continues — FCH will show 0 balance, other coins still work
  }
}

interface AccountState {
  // Auth state
  isLoggedIn: boolean;
  currentAccount: Account | null;
  keyManager: KeyManager | null;
  keystoreManager: KeystoreManager | null;

  // Key state
  keys: KeyEntry[];
  activeKeyId: string | null;

  // Account list
  availableAccounts: string[]; // account IDs

  // Actions
  setKeystoreManager: (km: KeystoreManager) => void;
  login: (password: string) => Promise<boolean>;
  createNewAccount: (password: string) => Promise<void>;
  logout: () => void;
  refreshKeys: () => void;
  setActiveKey: (fchAddress: string) => void;
  addRandomKey: () => Promise<KeyEntry>;
  importKeyHex: (hex: string) => Promise<KeyEntry>;
  importKeyWIF: (wif: string) => Promise<KeyEntry>;
  importKeyFromSecret: (secret: string) => Promise<KeyEntry>;
  importPublicKey: (pubKeyHex: string) => Promise<KeyEntry>;
  importKeyCipher: (cipherJson: string, password: string) => Promise<KeyEntry>;
  removeKey: (fchAddress: string) => Promise<void>;
  loadAvailableAccounts: () => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  isLoggedIn: false,
  currentAccount: null,
  keyManager: null,
  keystoreManager: null,
  keys: [],
  activeKeyId: null,
  availableAccounts: [],

  setKeystoreManager: (km: KeystoreManager) => {
    set({keystoreManager: km});
  },

  login: async (password: string) => {
    const {keystoreManager} = get();
    if (!keystoreManager) {
      throw new Error('KeystoreManager not initialized');
    }

    const account = createAccount(password);
    const exists = await keystoreManager.exists(account.id);
    if (!exists) {
      return false;
    }

    const keyManager = new KeyManager(keystoreManager);
    await keyManager.loadAccount(account);
    const keys = keyManager.listKeys();
    // Restore the key last used in the previous session (KeyManager loaded it from disk).
    const activeKey = keyManager.getActiveKey();
    const activeKeyId = activeKey?.id ?? null;

    // Set up FCH common API encryption keys BEFORE setting logged in
    if (activeKey?.privateKey) {
      await setupFchApiKeys(activeKey);
    }

    set({
      isLoggedIn: true,
      currentAccount: account,
      keyManager,
      keys,
      activeKeyId,
    });

    return true;
  },

  createNewAccount: async (password: string) => {
    const {keystoreManager} = get();
    if (!keystoreManager) {
      throw new Error('KeystoreManager not initialized');
    }

    const account = createAccount(password);
    const keyManager = new KeyManager(keystoreManager);
    await keyManager.loadAccount(account);

    // Auto-generate a first key
    const firstKey = await keyManager.addRandomKey();

    // Set up FCH common API encryption keys BEFORE setting logged in
    if (firstKey.privateKey) {
      await setupFchApiKeys(firstKey);
    }

    set({
      isLoggedIn: true,
      currentAccount: account,
      keyManager,
      keys: keyManager.listKeys(),
      activeKeyId: firstKey.id,
    });

    // Refresh account list
    get().loadAvailableAccounts();
  },

  logout: () => {
    const {keyManager} = get();
    if (keyManager) {
      keyManager.clear();
    }
    set({
      isLoggedIn: false,
      currentAccount: null,
      keyManager: null,
      keys: [],
      activeKeyId: null,
    });
  },

  refreshKeys: () => {
    const {keyManager} = get();
    if (keyManager) {
      set({keys: keyManager.listKeys()});
    }
  },

  setActiveKey: (fchAddress: string) => {
    const {keyManager, keys} = get();
    if (keyManager) {
      set({activeKeyId: fchAddress});
      // Persist the selection so it survives a relaunch (fire-and-forget).
      keyManager
        .setActiveKey(fchAddress)
        .catch(e => console.warn('[setActiveKey] failed to persist:', e.message));
      const key = keys.find(k => k.id === fchAddress);
      if (key?.privateKey) {
        setupFchApiKeys(key);
      }
    }
  },

  addRandomKey: async () => {
    const {keyManager} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    const entry = await keyManager.addRandomKey();
    set({keys: keyManager.listKeys()});
    return entry;
  },

  importKeyHex: async (hex: string) => {
    const {keyManager} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    const entry = await keyManager.importKeyHex(hex);
    set({keys: keyManager.listKeys()});
    return entry;
  },

  importKeyWIF: async (wif: string) => {
    const {keyManager} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    const entry = await keyManager.importKeyWIF(wif);
    set({keys: keyManager.listKeys()});
    return entry;
  },

  importKeyFromSecret: async (secret: string) => {
    const {keyManager} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    const entry = await keyManager.importKeyFromSecret(secret);
    set({keys: keyManager.listKeys()});
    return entry;
  },

  importPublicKey: async (pubKeyHex: string) => {
    const {keyManager} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    const entry = await keyManager.importPublicKey(pubKeyHex);
    set({keys: keyManager.listKeys()});
    return entry;
  },

  importKeyCipher: async (cipherJson: string, password: string) => {
    const {keyManager} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    const entry = await keyManager.importKeyCipher(cipherJson, password);
    set({keys: keyManager.listKeys()});
    return entry;
  },

  removeKey: async (fchAddress: string) => {
    const {keyManager, keystoreManager, currentAccount} = get();
    if (!keyManager) {
      throw new Error('Not logged in');
    }
    await keyManager.removeKey(fchAddress);
    const keys = keyManager.listKeys();

    if (keys.length === 0 && keystoreManager && currentAccount) {
      // No keys left — delete the account and logout
      await keystoreManager.delete(currentAccount.id);
      keyManager.clear();
      set({
        isLoggedIn: false,
        currentAccount: null,
        keyManager: null,
        keys: [],
        activeKeyId: null,
      });
      // Refresh account list
      const accounts = await keystoreManager.listAccounts();
      set({availableAccounts: accounts});
    } else {
      const active = keyManager.getActiveKey();
      set({keys, activeKeyId: active?.id || null});
    }
  },

  loadAvailableAccounts: async () => {
    const {keystoreManager} = get();
    if (keystoreManager) {
      const accounts = await keystoreManager.listAccounts();
      set({availableAccounts: accounts});
    }
  },
}));
