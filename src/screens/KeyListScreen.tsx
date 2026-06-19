import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountStore} from '../store/account-store';
import {useWalletStore} from '../store/wallet-store';
import {Avatar} from '../components/Avatar';
import {formatAddress} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function KeyListScreen({navigation}: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const {keys, activeKeyId, setActiveKey, removeKey, currentAccount} = useAccountStore();
  const {initializeForKey, clearWallet} = useWalletStore();

  const handleSelectKey = (fchAddress: string) => {
    setActiveKey(fchAddress);
    const key = keys.find(k => k.id === fchAddress);
    if (key) {
      initializeForKey(key.addresses);
    }
    // Navigate to the Wallet tab's Dashboard
    navigation.getParent()?.navigate('WalletTab');
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDeleteKey = (fchAddress: string) => {
    setDeleteTarget(fchAddress);
    setHoldProgress(0);
  };

  const handleHoldStart = () => {
    setHoldProgress(0);
    const startTime = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 3000, 1);
      setHoldProgress(progress);
      if (progress >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        holdTimer.current = null;
        doRemoveKey();
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);
  };

  const doRemoveKey = async () => {
    if (!deleteTarget) return;
    const isLast = keys.length === 1;
    try {
      if (isLast) {
        clearWallet();
      }
      await removeKey(deleteTarget);
      setDeleteTarget(null);
      setHoldProgress(0);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    }
  };

  const handleAddKey = () => {
    navigation.navigate('AddKey');
  };

  const isLastKey = keys.length === 1;

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top + spacing.lg}]}>
        <Text style={styles.title}>{t('keyList.title')}</Text>
        <Text style={styles.accountLabel}>
          {t('keyList.account', {id: currentAccount?.id || ''})}
        </Text>
      </View>

      <FlatList
        data={keys}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <TouchableOpacity
            style={[
              styles.keyCard,
              item.id === activeKeyId && styles.keyCardActive,
            ]}
            onPress={() => handleSelectKey(item.id)}
            onLongPress={() => handleDeleteKey(item.id)}>
            <View style={styles.keyHeader}>
              <View style={styles.headerRight}>
                {item.id === activeKeyId && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{t('keyList.active')}</Text>
                  </View>
                )}
                <Text style={styles.keyLabel}>
                  {item.isWatchOnly ? t('keyList.watchOnly') : t('keyList.fullAccess')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteKey(item.id)}>
                <Text style={styles.deleteButtonText}>X</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.keyBody}>
              <Avatar address={item.id} size={48} />
              <View style={styles.keyInfo}>
                <Text style={styles.fchAddress} numberOfLines={1} ellipsizeMode="middle">
                  {item.id}
                </Text>
                <Text style={styles.btcAddress}>
                  BTC: {formatAddress(item.addresses.BTC)}
                </Text>
                <Text style={styles.ethAddress}>
                  ETH: {formatAddress(item.addresses.ETH)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('keyList.emptyTitle')}</Text>
            <Text style={styles.emptySubtext}>
              {t('keyList.emptySubtitle')}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddKey}>
        <Text style={styles.addButtonText}>{t('keyList.addKey')}</Text>
      </TouchableOpacity>

      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('keyList.removeTitle')}</Text>
            <Text style={styles.modalAddress} numberOfLines={2}>
              {deleteTarget}
            </Text>
            {isLastKey && (
              <Text style={styles.modalWarning}>
                {t('keyList.lastKeyWarning')}
              </Text>
            )}
            <Text style={styles.modalHint}>
              {t('keyList.holdHint')}
            </Text>

            <Pressable
              style={styles.holdButton}
              onPressIn={handleHoldStart}
              onPressOut={handleHoldEnd}>
              <View
                style={[
                  styles.holdProgress,
                  {width: `${holdProgress * 100}%`},
                ]}
              />
              <Text style={styles.holdButtonText}>
                {holdProgress >= 1
                  ? t('keyList.removing')
                  : holdProgress > 0
                  ? t('keyList.holdCountdown', {seconds: Math.ceil(3 - holdProgress * 3)})
                  : t('keyList.holdToRemove')}
              </Text>
            </Pressable>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                handleHoldEnd();
                setDeleteTarget(null);
              }}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  accountLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  keyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  keyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  keyLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  keyBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  fchAddress: {
    fontSize: fontSize.md,
    color: colors.text,
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  btcAddress: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  ethAddress: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  addButton: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalAddress: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalWarning: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalHint: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  holdButton: {
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.error,
  },
  holdProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.error,
    borderRadius: 11,
  },
  holdButtonText: {
    color: colors.error,
    fontSize: fontSize.md,
    fontWeight: '600',
    zIndex: 1,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
