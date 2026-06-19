import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountStore} from '../store/account-store';
import {useSettingsStore} from '../store/settings-store';
import {useWalletStore} from '../store/wallet-store';
import {CoinType} from '../coins/types';
import {COINS, isCoinHidden} from '../coins/registry';
import {getMinFeeRate, DEFAULT_FEE_RATES, estimateUtxoFee} from '../coins/send-service';
import {coinColor, formatCoinBalance} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {bytesToHex, encodeWIF} from '../crypto/encoding';
import {encryptToHex} from '../crypto/aes';
import {KeyEntry} from '../account/keystore';
import {BlockCypherAPI} from '../api/providers/blockcypher';
import {BlockchairAPI} from '../api/providers/blockchair';
import {BlockbookAPI} from '../api/providers/blockbook';
import {EthereumAPI} from '../api/providers/ethereum';
import {setProvider} from '../api/api-registry';
import {useT, useI18nStore, LangSetting} from '../i18n';

const DESC_KEYS: Record<string, string> = {
  fch: 'settings.descFch',
  btc: 'settings.descBtc',
  doge: 'settings.descDoge',
  bch: 'settings.descBch',
  eth: 'settings.descEth',
};

const LANGUAGE_OPTIONS: {value: LangSetting; labelKey: string}[] = [
  {value: 'system', labelKey: 'settings.langSystem'},
  {value: 'en', labelKey: 'settings.langEnglish'},
  {value: 'zh', labelKey: 'settings.langChinese'},
];

// ── Provider presets ────────────────────────────────────────
// To change defaults: set `default: true` on the desired preset.
// Each group must have exactly one default.

interface Preset {
  key: string;
  label: string;
  url: string;
  provider: 'blockcypher' | 'blockchair' | 'blockbook' | 'ethereum' | 'fch';
  showApiKey: boolean;
  apiKeyLabel?: string;
  default?: boolean;
}

const ALL_API_GROUPS = [
  {
    key: 'fch',
    label: 'FCH (Freecash)',
    coins: [CoinType.FCH],
    color: coinColor(CoinType.FCH),
    desc: 'Freecash API server with encrypted requests.',
    presets: [
      {key: 'fch_default', label: 'Freecash APIP', url: 'https://freecash.info/APIP', provider: 'fch', showApiKey: false, default: true},
      {key: 'custom', label: 'Custom URL…', url: '', provider: 'fch', showApiKey: false},
    ] as Preset[],
  },
  {
    key: 'btc',
    label: 'BTC (Bitcoin)',
    coins: [CoinType.BTC],
    color: coinColor(CoinType.BTC),
    desc: 'API provider for Bitcoin.',
    presets: [
      {key: 'blockcypher', label: 'BlockCypher', url: 'https://api.blockcypher.com/v1', provider: 'blockcypher', showApiKey: true, default: true},
      {key: 'blockchair', label: 'Blockchair', url: 'https://api.blockchair.com', provider: 'blockchair', showApiKey: true},
      {key: 'custom', label: 'Custom URL…', url: '', provider: 'blockcypher', showApiKey: true},
    ] as Preset[],
  },
  {
    key: 'doge',
    label: 'DOGE (Dogecoin)',
    coins: [CoinType.DOGE],
    color: coinColor(CoinType.DOGE),
    desc: 'API provider for Dogecoin.',
    presets: [
      {key: 'blockcypher', label: 'BlockCypher', url: 'https://api.blockcypher.com/v1', provider: 'blockcypher', showApiKey: true, default: true},
      {key: 'blockchair', label: 'Blockchair', url: 'https://api.blockchair.com', provider: 'blockchair', showApiKey: true},
      {key: 'custom', label: 'Custom URL…', url: '', provider: 'blockcypher', showApiKey: true},
    ] as Preset[],
  },
  {
    key: 'bch',
    label: 'BCH (Bitcoin Cash)',
    coins: [CoinType.BCH],
    color: coinColor(CoinType.BCH),
    desc: 'API provider for Bitcoin Cash.',
    presets: [
      {key: 'blockbook', label: 'Blockbook (Trezor)', url: 'https://bch1.trezor.io', provider: 'blockbook', showApiKey: false, default: true},
      {key: 'blockchair', label: 'Blockchair', url: 'https://api.blockchair.com', provider: 'blockchair', showApiKey: true},
      {key: 'custom', label: 'Custom URL…', url: '', provider: 'blockbook', showApiKey: false},
    ] as Preset[],
  },
  {
    key: 'eth',
    label: 'ETH, USDT & USDC',
    coins: [CoinType.ETH, CoinType.USDT, CoinType.USDC],
    color: coinColor(CoinType.ETH),
    desc: 'Ethereum JSON-RPC for balances and broadcasting.',
    presets: [
      {key: 'publicnode', label: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com', provider: 'ethereum', showApiKey: true, apiKeyLabel: 'Etherscan API Key (for TX history)', default: true},
      {key: 'ankr', label: 'Ankr', url: 'https://rpc.ankr.com/eth', provider: 'ethereum', showApiKey: true, apiKeyLabel: 'Etherscan API Key (for TX history)'},
      {key: 'custom', label: 'Custom URL…', url: '', provider: 'ethereum', showApiKey: true, apiKeyLabel: 'Etherscan API Key (for TX history)'},
    ] as Preset[],
  },
];

// Groups whose coins are all hidden are dropped from the settings UI.
const API_GROUPS = ALL_API_GROUPS.filter(g => g.coins.some(c => !isCoinHidden(c)));

function getDefaultPresetKey(group: typeof API_GROUPS[0]): string {
  return group.presets.find(p => p.default)?.key || group.presets[0].key;
}

// UTXO coins whose per-byte fee rate is user-configurable.
const FEE_COINS: CoinType[] = [CoinType.DOGE, CoinType.BTC, CoinType.BCH, CoinType.FCH].filter(
  c => !isCoinHidden(c),
);

function defaultFeeRate(coin: CoinType): number {
  return DEFAULT_FEE_RATES[coin] ?? getMinFeeRate(coin);
}

interface GroupState {
  url: string;
  apiKey: string;
}

export function SettingsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const {setting: langSetting, setLanguage} = useI18nStore();
  const {currentAccount, logout, keys} = useAccountStore();
  const {apiEndpoints, apiProviderTypes, setApiEndpoint, setApiProviderType, customApiUrl, setCustomApiUrl, feeRates, setFeeRate} = useSettingsStore();
  const {clearWallet} = useWalletStore();

  // Backup state
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [backupFormat, setBackupFormat] = useState<'hex' | 'wif'>('hex');
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const selectedKey: KeyEntry | undefined = keys.find(k => k.id === selectedKeyId);
  const hasPrivateKey = selectedKey && !selectedKey.isWatchOnly && selectedKey.privateKey;

  const getPrivateKeyDisplay = (): string => {
    if (!hasPrivateKey || !selectedKey?.privateKey) return '';
    if (backupFormat === 'hex') {
      return bytesToHex(selectedKey.privateKey);
    }
    return encodeWIF(selectedKey.privateKey);
  };

  const handleCopyCipher = () => {
    if (!hasPrivateKey || !selectedKey?.privateKey || !currentAccount) return;
    const encrypted = encryptToHex(selectedKey.privateKey, currentAccount.symkey);
    // Convert hex ciphertext to Base64 for CryptoDataStr compatibility
    const cipherBytes = new Uint8Array(
      encrypted.ciphertext.match(/.{2}/g)!.map(b => parseInt(b, 16)),
    );
    let binary = '';
    for (let i = 0; i < cipherBytes.length; i++) {
      binary += String.fromCharCode(cipherBytes[i]);
    }
    const cipherBase64 = btoa(binary);
    const cipherJson = JSON.stringify({
      type: 'Password',
      alg: 'AesGcm256@No1_NrC7',
      cipher: cipherBase64,
      keyName: currentAccount.id,
      iv: encrypted.iv,
    });
    Clipboard.setString(cipherJson);
    Alert.alert(t('settings.copiedTitle'), t('settings.cipherCopiedMsg'));
  };

  // Initialize local state from store
  const [groups, setGroups] = useState<Record<string, GroupState>>({});
  const [selectedPresets, setSelectedPresets] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const initial: Record<string, GroupState> = {};
    const initialPresets: Record<string, string> = {};
    for (const group of API_GROUPS) {
      const firstCoin = group.coins[0];
      const endpoint = apiEndpoints[firstCoin];
      const savedPreset = apiProviderTypes[group.key];
      const presetKey = savedPreset || getDefaultPresetKey(group);
      const preset = group.presets.find(p => p.key === presetKey);
      initialPresets[group.key] = presetKey;
      initial[group.key] = {
        url: presetKey === 'custom'
          ? (group.key === 'fch' ? (customApiUrl || endpoint?.baseUrl || '') : (endpoint?.baseUrl || ''))
          : (preset?.url || ''),
        apiKey: endpoint?.apiKey || '',
      };
    }
    setGroups(initial);
    setSelectedPresets(initialPresets);
  }, [apiEndpoints, apiProviderTypes, customApiUrl]);

  // Fee rate inputs, keyed by coin
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const coin of FEE_COINS) {
      initial[coin] = String(feeRates[coin] ?? defaultFeeRate(coin));
    }
    setFeeInputs(initial);
  }, [feeRates]);

  const handleSaveFee = (coin: CoinType) => {
    const parsed = Number((feeInputs[coin] ?? '').trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      Alert.alert(t('common.error'), t('settings.feeInvalid'));
      return;
    }
    const rate = Math.max(parsed, getMinFeeRate(coin));
    setFeeRate(coin, rate);
    setFeeInputs(prev => ({...prev, [coin]: String(rate)}));
    Alert.alert(t('common.saved'), t('settings.feeSavedMsg', {label: COINS[coin].ticker}));
  };

  const updateGroup = (key: string, field: 'url' | 'apiKey', value: string) => {
    setGroups(prev => ({
      ...prev,
      [key]: {...prev[key], [field]: value},
    }));
  };

  const handleSaveGroup = (group: typeof API_GROUPS[0]) => {
    const state = groups[group.key];
    if (!state) return;

    const presetKey = selectedPresets[group.key] || getDefaultPresetKey(group);
    const preset = group.presets.find(p => p.key === presetKey);
    const url = presetKey === 'custom' ? state.url.trim() : (preset?.url || state.url.trim());
    const apiKey = state.apiKey.trim() || undefined;
    const providerType = preset?.provider || 'blockcypher';

    for (const coin of group.coins) {
      setApiEndpoint(coin, {baseUrl: url, apiKey});
    }
    setApiProviderType(group.key, presetKey);

    // Also update customApiUrl for FCH (used by initializeProviders)
    if (group.key === 'fch') {
      setCustomApiUrl(url);
    }

    // Re-create providers with updated endpoint and correct class
    if (group.key === 'btc' || group.key === 'doge' || group.key === 'bch') {
      for (const coin of group.coins) {
        if (providerType === 'blockchair') {
          setProvider(coin, new BlockchairAPI(coin, {baseUrl: url, apiKey}));
        } else if (providerType === 'blockbook') {
          setProvider(coin, new BlockbookAPI(coin, {baseUrl: url, apiKey}));
        } else {
          setProvider(coin, new BlockCypherAPI(coin, {baseUrl: url, apiKey}));
        }
      }
    }

    if (group.key === 'eth') {
      for (const coin of group.coins) {
        setProvider(coin, new EthereumAPI(coin, {baseUrl: url, apiKey}));
      }
    }

    Alert.alert(t('common.saved'), t('settings.apiSavedMsg', {label: group.label}));
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () => {
          clearWallet();
          logout();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingTop: insets.top}}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('settings.accountId')}</Text>
          <Text style={styles.infoValue}>{currentAccount?.id || '-'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <Text style={styles.sectionDesc}>{t('settings.languageDesc')}</Text>
        <View style={styles.langToggle}>
          {LANGUAGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.langButton, langSetting === opt.value && styles.langButtonActive]}
              onPress={() => setLanguage(opt.value)}>
              <Text
                style={[
                  styles.langButtonText,
                  langSetting === opt.value && styles.langButtonTextActive,
                ]}>
                {t(opt.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.backupTitle')}</Text>
        <Text style={styles.sectionDesc}>{t('settings.backupDesc')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.keySelector}>
          {keys.filter(k => !k.isWatchOnly && k.privateKey).map(k => (
            <TouchableOpacity
              key={k.id}
              style={[styles.keySelectorItem, selectedKeyId === k.id && styles.keySelectorItemActive]}
              onPress={() => {
                setSelectedKeyId(k.id);
                setShowPrivateKey(false);
              }}>
              <Text
                style={[styles.keySelectorText, selectedKeyId === k.id && styles.keySelectorTextActive]}
                numberOfLines={1}>
                {k.id.slice(0, 6)}...{k.id.slice(-4)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedKey && hasPrivateKey && (
          <View style={styles.backupCard}>
            <Text style={styles.backupKeyId} numberOfLines={1}>{selectedKey.id}</Text>

            <View style={styles.formatToggle}>
              <TouchableOpacity
                style={[styles.formatButton, backupFormat === 'hex' && styles.formatButtonActive]}
                onPress={() => setBackupFormat('hex')}>
                <Text style={[styles.formatButtonText, backupFormat === 'hex' && styles.formatButtonTextActive]}>Hex</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formatButton, backupFormat === 'wif' && styles.formatButtonActive]}
                onPress={() => setBackupFormat('wif')}>
                <Text style={[styles.formatButtonText, backupFormat === 'wif' && styles.formatButtonTextActive]}>WIF</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.revealButton}
              onPress={() => setShowPrivateKey(!showPrivateKey)}>
              <Text style={styles.revealButtonText}>
                {showPrivateKey ? t('settings.hidePrikey') : t('settings.revealPrikey')}
              </Text>
            </TouchableOpacity>

            {showPrivateKey && (
              <View style={styles.qrContainer}>
                <QRCode
                  value={getPrivateKeyDisplay()}
                  size={200}
                  backgroundColor={colors.surface}
                  color={colors.text}
                />
                <Text style={styles.privkeyText} selectable>
                  {getPrivateKeyDisplay()}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.cipherButton} onPress={handleCopyCipher}>
              <Text style={styles.cipherButtonText}>{t('settings.copyCipher')}</Text>
            </TouchableOpacity>
            <Text style={styles.cipherHint}>{t('settings.cipherHint')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('settings.apiEndpoints')}</Text>
      <Text style={styles.sectionDesc}>{t('settings.apiEndpointsDesc')}</Text>

      {API_GROUPS.map(group => {
        const state = groups[group.key] || {url: '', apiKey: ''};
        const presetKey = selectedPresets[group.key] || getDefaultPresetKey(group);
        const activePreset = group.presets.find(p => p.key === presetKey);
        const isCustom = presetKey === 'custom';
        return (
          <View key={group.key} style={styles.apiCard}>
            <View style={styles.apiCardHeader}>
              <View style={[styles.coinDot, {backgroundColor: group.color}]} />
              <Text style={styles.apiCardTitle}>{group.label}</Text>
            </View>
            <Text style={styles.apiCardDesc}>{t(DESC_KEYS[group.key] || '')}</Text>

            <Text style={styles.fieldLabel}>{t('settings.provider')}</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setOpenDropdown(group.key)}>
              <Text style={styles.dropdownText}>
                {activePreset
                  ? activePreset.key === 'custom'
                    ? t('settings.customUrl')
                    : activePreset.label
                  : t('common.select')}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            {!isCustom && (
              <Text style={styles.presetUrl}>{activePreset?.url}</Text>
            )}

            {isCustom && (
              <>
                <Text style={styles.fieldLabel}>{t('settings.apiUrl')}</Text>
                <TextInput
                  style={[styles.input, styles.monoInput]}
                  value={state.url}
                  onChangeText={v => updateGroup(group.key, 'url', v)}
                  placeholder="https://..."
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}

            <Modal
              visible={openDropdown === group.key}
              transparent
              animationType="fade"
              onRequestClose={() => setOpenDropdown(null)}>
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setOpenDropdown(null)}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{group.label}</Text>
                  {group.presets.map(preset => (
                    <TouchableOpacity
                      key={preset.key}
                      style={[styles.modalItem, presetKey === preset.key && {backgroundColor: group.color}]}
                      onPress={() => {
                        setSelectedPresets(prev => ({...prev, [group.key]: preset.key}));
                        if (preset.key !== 'custom') {
                          updateGroup(group.key, 'url', preset.url);
                        }
                        setOpenDropdown(null);
                      }}>
                      <Text style={[styles.modalItemText, presetKey === preset.key && styles.modalItemTextActive]}>
                        {preset.key === 'custom' ? t('settings.customUrl') : preset.label}
                      </Text>
                      {preset.key !== 'custom' && (
                        <Text style={[styles.modalItemUrl, presetKey === preset.key && styles.modalItemUrlActive]}>
                          {preset.url}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>

            {(activePreset?.showApiKey ?? false) && (
              <>
                <Text style={styles.fieldLabel}>
                  {activePreset?.apiKeyLabel
                    ? t('settings.apiKeyEtherscan')
                    : t('settings.apiKeyOptional')}
                </Text>
                <TextInput
                  style={[styles.input, styles.monoInput]}
                  value={state.apiKey}
                  onChangeText={v => updateGroup(group.key, 'apiKey', v)}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.saveButton, {backgroundColor: group.color}]}
              onPress={() => handleSaveGroup(group)}>
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>{t('settings.fees')}</Text>
      <Text style={styles.sectionDesc}>{t('settings.feesDesc')}</Text>

      {FEE_COINS.map(coin => {
        const min = getMinFeeRate(coin);
        const parsed = Number((feeInputs[coin] ?? '').trim());
        const effective =
          Number.isInteger(parsed) && parsed > 0 ? Math.max(parsed, min) : defaultFeeRate(coin);
        const estFee = formatCoinBalance(String(estimateUtxoFee(effective)), coin);
        const ticker = COINS[coin].ticker;
        return (
          <View key={coin} style={styles.apiCard}>
            <View style={styles.apiCardHeader}>
              <View style={[styles.coinDot, {backgroundColor: coinColor(coin)}]} />
              <Text style={styles.apiCardTitle}>{ticker}</Text>
            </View>

            <Text style={styles.fieldLabel}>{t('settings.feeRateLabel')}</Text>
            <TextInput
              style={[styles.input, styles.monoInput]}
              value={feeInputs[coin] ?? ''}
              onChangeText={v => setFeeInputs(prev => ({...prev, [coin]: v.replace(/[^0-9]/g, '')}))}
              placeholder={String(defaultFeeRate(coin))}
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
            />
            <Text style={styles.presetUrl}>{t('settings.feeMin', {min})}</Text>
            <Text style={styles.apiCardDesc}>
              {t('settings.feeTypical', {fee: estFee, ticker})}
            </Text>

            <TouchableOpacity
              style={[styles.saveButton, {backgroundColor: coinColor(coin)}]}
              onPress={() => handleSaveFee(coin)}>
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('settings.app')}</Text>
          <Text style={styles.infoValue}>MyCoins v0.1.0</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>{t('settings.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sectionDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  infoRow: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  apiCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  apiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  coinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  apiCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  apiCardDesc: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  monoInput: {
    fontFamily: 'monospace',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  dropdownText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  dropdownArrow: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  presetUrl: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  modalItemText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  modalItemTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  modalItemUrl: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  modalItemUrlActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  saveButton: {
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  langToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  langButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  langButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  keySelector: {
    marginBottom: spacing.md,
  },
  keySelectorItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  keySelectorItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  keySelectorText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontFamily: 'monospace',
  },
  keySelectorTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  backupCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backupKeyId: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: spacing.sm,
  },
  formatToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formatButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formatButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  formatButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  formatButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  revealButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  revealButtonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  privkeyText: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontFamily: 'monospace',
    marginTop: spacing.md,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  cipherButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  cipherButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  cipherHint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
