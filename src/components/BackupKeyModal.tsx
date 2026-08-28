import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import {KeyEntry} from '../account/keystore';
import {useAccountStore} from '../store/account-store';
import {bytesToHex, encodeWIF} from '../crypto/encoding';
import {encryptToHex} from '../crypto/aes';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';
import {Avatar} from './Avatar';

/** A key holds a secret that could still be lost, so it needs a backup. */
export function needsBackup(key: KeyEntry): boolean {
  return !key.isWatchOnly && !!key.privateKey && !key.backedUp;
}

interface Props {
  visible: boolean;
  keyEntry: KeyEntry | null | undefined;
  onClose: () => void;
}

export function BackupKeyModal({visible, keyEntry, onClose}: Props) {
  const t = useT();
  const {currentAccount, markKeyBackedUp} = useAccountStore();
  const [format, setFormat] = useState<'hex' | 'wif'>('hex');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  // The confirm button only unlocks once the key has actually left the app.
  const [exported, setExported] = useState(false);

  // Never carry a revealed key across openings.
  useEffect(() => {
    if (!visible) {
      setShowPrivateKey(false);
      setExported(false);
      setFormat('hex');
    }
  }, [visible]);

  if (!keyEntry || !keyEntry.privateKey) {
    return null;
  }
  const privateKey = keyEntry.privateKey;

  const keyDisplay =
    format === 'hex' ? bytesToHex(privateKey) : encodeWIF(privateKey);

  const handleReveal = () => {
    const next = !showPrivateKey;
    setShowPrivateKey(next);
    if (next) {
      setExported(true);
    }
  };

  const handleCopyCipher = () => {
    if (!currentAccount) return;
    const encrypted = encryptToHex(privateKey, currentAccount.symkey);
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
    setExported(true);
    Alert.alert(t('backup.copiedTitle'), t('backup.cipherCopiedMsg'));
  };

  const handleConfirm = async () => {
    try {
      await markKeyBackedUp(keyEntry.id);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <Text style={styles.title}>{t('backup.title')}</Text>

            <View style={styles.keyHeader}>
              <Avatar address={keyEntry.id} size={40} />
              <Text style={styles.keyId} numberOfLines={2} ellipsizeMode="middle">
                {keyEntry.id}
              </Text>
            </View>

            <Text style={styles.warning}>{t('backup.warning')}</Text>

            <View style={styles.formatToggle}>
              {(['hex', 'wif'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.formatButton, format === f && styles.formatButtonActive]}
                  onPress={() => setFormat(f)}>
                  <Text
                    style={[
                      styles.formatButtonText,
                      format === f && styles.formatButtonTextActive,
                    ]}>
                    {f === 'hex' ? 'Hex' : 'WIF'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.revealButton} onPress={handleReveal}>
              <Text style={styles.revealButtonText}>
                {showPrivateKey ? t('backup.hidePrikey') : t('backup.revealPrikey')}
              </Text>
            </TouchableOpacity>

            {showPrivateKey && (
              <View style={styles.qrContainer}>
                <QRCode
                  value={keyDisplay}
                  size={180}
                  backgroundColor={colors.surface}
                  color={colors.text}
                />
                <Text style={styles.privkeyText} selectable>
                  {keyDisplay}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.cipherButton} onPress={handleCopyCipher}>
              <Text style={styles.cipherButtonText}>{t('backup.copyCipher')}</Text>
            </TouchableOpacity>
            <Text style={styles.cipherHint}>{t('backup.cipherHint')}</Text>

            {keyEntry.backedUp ? (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>✓ {t('backup.alreadyBackedUp')}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.confirmButton, !exported && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={!exported}>
                  <Text style={styles.confirmButtonText}>
                    {t('backup.confirmSaved')}
                  </Text>
                </TouchableOpacity>
                {!exported && (
                  <Text style={styles.confirmHint}>{t('backup.confirmHint')}</Text>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    paddingTop: spacing.lg,
  },
  scrollBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  keyId: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  warning: {
    fontSize: fontSize.sm,
    color: colors.error,
    lineHeight: 18,
    marginBottom: spacing.md,
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
  confirmButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  confirmHint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  doneBadge: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  doneBadgeText: {
    fontSize: fontSize.md,
    color: colors.success,
    fontWeight: '600',
  },
  closeButton: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
