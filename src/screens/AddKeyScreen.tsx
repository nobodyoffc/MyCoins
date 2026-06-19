import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {useAccountStore} from '../store/account-store';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';
import {QrScanIcon} from '../components/TabIcons';
import {QrScannerModal} from '../components/QrScannerModal';

type ImportMode = 'random' | 'hex' | 'wif' | 'secret' | 'pubkey' | 'cipher';

// Which field a scan result should be written into.
type ScanTarget = 'input' | 'cipherPassword';

export function AddKeyScreen({navigation}: any) {
  const t = useT();
  const [mode, setMode] = useState<ImportMode>('random');
  const [inputValue, setInputValue] = useState('');
  const [cipherPassword, setCipherPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);

  const handleScanned = (value: string) => {
    if (scanTarget === 'cipherPassword') {
      setCipherPassword(value);
    } else if (scanTarget === 'input') {
      setInputValue(value);
    }
  };
  const {addRandomKey, importKeyHex, importKeyWIF, importKeyFromSecret, importPublicKey, importKeyCipher} =
    useAccountStore();

  const handleAdd = async () => {
    setLoading(true);
    try {
      let entry;
      switch (mode) {
        case 'random':
          entry = await addRandomKey();
          break;
        case 'hex':
          if (!inputValue.trim()) {
            Alert.alert(t('common.error'), t('addKey.errorEnterHex'));
            return;
          }
          entry = await importKeyHex(inputValue.trim());
          break;
        case 'wif':
          if (!inputValue.trim()) {
            Alert.alert(t('common.error'), t('addKey.errorEnterWif'));
            return;
          }
          entry = await importKeyWIF(inputValue.trim());
          break;
        case 'secret':
          if (!inputValue.trim()) {
            Alert.alert(t('common.error'), t('addKey.errorEnterSecret'));
            return;
          }
          entry = await importKeyFromSecret(inputValue.trim());
          break;
        case 'pubkey':
          if (!inputValue.trim()) {
            Alert.alert(t('common.error'), t('addKey.errorEnterPubkey'));
            return;
          }
          entry = await importPublicKey(inputValue.trim());
          break;
        case 'cipher':
          if (!inputValue.trim()) {
            Alert.alert(t('common.error'), t('addKey.errorEnterCipher'));
            return;
          }
          if (!cipherPassword) {
            Alert.alert(t('common.error'), t('addKey.errorEnterCipherPassword'));
            return;
          }
          entry = await importKeyCipher(inputValue.trim(), cipherPassword);
          break;
      }
      Alert.alert(t('addKey.success'), t('addKey.keyAdded', {id: entry!.id}), [
        {text: t('common.ok'), onPress: () => navigation.goBack()},
      ]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const modes: {key: ImportMode; label: string; desc: string}[] = [
    {key: 'random', label: t('addKey.modeRandomLabel'), desc: t('addKey.modeRandomDesc')},
    {key: 'hex', label: t('addKey.modeHexLabel'), desc: t('addKey.modeHexDesc')},
    {key: 'wif', label: t('addKey.modeWifLabel'), desc: t('addKey.modeWifDesc')},
    {key: 'secret', label: t('addKey.modeSecretLabel'), desc: t('addKey.modeSecretDesc')},
    {key: 'pubkey', label: t('addKey.modePubkeyLabel'), desc: t('addKey.modePubkeyDesc')},
    {key: 'cipher', label: t('addKey.modeCipherLabel'), desc: t('addKey.modeCipherDesc')},
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('addKey.title')}</Text>

      <Text style={styles.sectionTitle}>{t('addKey.source')}</Text>
      <View style={styles.modeContainer}>
        {modes.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeButton, mode === m.key && styles.modeButtonActive]}
            onPress={() => {
              setMode(m.key);
              setInputValue('');
              setCipherPassword('');
            }}>
            <Text
              style={[
                styles.modeButtonText,
                mode === m.key && styles.modeButtonTextActive,
              ]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.modeDesc}>
        {modes.find(m => m.key === mode)?.desc}
      </Text>

      {mode !== 'random' && (
        <>
          <Text style={styles.label}>
            {mode === 'hex'
              ? t('addKey.labelPrikeyHex')
              : mode === 'wif'
              ? t('addKey.labelPrikeyWif')
              : mode === 'secret'
              ? t('addKey.labelSecretString')
              : mode === 'cipher'
              ? t('addKey.labelCipherJson')
              : t('addKey.labelPublicKeyHex')}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                mode === 'secret' ? null : styles.monoInput,
              ]}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={
                mode === 'hex'
                  ? t('addKey.placeholderHex')
                  : mode === 'wif'
                  ? t('addKey.placeholderWif')
                  : mode === 'secret'
                  ? t('addKey.placeholderSecret')
                  : mode === 'cipher'
                  ? t('addKey.placeholderCipher')
                  : t('addKey.placeholderPubkey')
              }
              placeholderTextColor={colors.textLight}
              multiline={mode !== 'secret'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setScanTarget('input')}
              accessibilityLabel={t('scanner.title')}>
              <QrScanIcon size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {mode === 'cipher' && (
            <>
              <Text style={styles.label}>{t('addKey.labelPassword')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={cipherPassword}
                  onChangeText={setCipherPassword}
                  placeholder={t('addKey.placeholderCipherPassword')}
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={() => setScanTarget('cipherPassword')}
                  accessibilityLabel={t('scanner.title')}>
                  <QrScanIcon size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'random' ? t('addKey.generateKey') : t('addKey.importKey')}
          </Text>
        )}
      </TouchableOpacity>

      <QrScannerModal
        visible={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onScanned={handleScanned}
      />
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
  sectionTitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  modeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  modeButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  modeDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    minHeight: 48,
  },
  monoInput: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inputFlex: {
    flex: 1,
  },
  scanButton: {
    marginLeft: spacing.sm,
    marginBottom: spacing.lg,
    minHeight: 48,
    minWidth: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
