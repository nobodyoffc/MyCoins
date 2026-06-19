import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import {useAccountStore} from '../store/account-store';
import {useWalletStore} from '../store/wallet-store';
import {CoinType} from '../coins/types';
import {COINS} from '../coins/registry';
import {formatCoinBalance, coinColor} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function CoinDetailScreen({route, navigation}: any) {
  const t = useT();
  const {coin} = route.params as {coin: CoinType};
  const config = COINS[coin];
  const color = coinColor(coin);

  const {activeKeyId, keys} = useAccountStore();
  const {balances, fetchTransactions, getDisplayBalanceText, getMergedTransactions, pendingTxs} = useWalletStore();

  const activeKey = keys.find(k => k.id === activeKeyId);
  const balance = balances[coin];
  const balanceText = getDisplayBalanceText(coin);
  // Only show the ticker alongside an actual amount, not next to a bare '-'/'!'.
  const hasAmount =
    balance.status === 'ok' || (balance.status === 'error' && balance.hasCachedValue);
  const txs = getMergedTransactions(coin);

  useEffect(() => {
    fetchTransactions(coin);
  }, [coin]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, {backgroundColor: color + '15'}]}>
        <View style={[styles.coinIcon, {backgroundColor: color + '30'}]}>
          <Text style={[styles.coinIconText, {color}]}>{config.ticker}</Text>
        </View>
        <Text style={styles.coinName}>{config.name}</Text>
        <Text style={styles.balance}>
          {balanceText}{hasAmount ? ` ${config.ticker}` : ''}
        </Text>
        <Text style={styles.address} selectable>
          {balance.address}
        </Text>
      </View>

      <View style={styles.txSection}>
        <Text style={styles.txSectionTitle}>{t('coinDetail.transactions')}</Text>
        {txs.length === 0 ? (
          <View style={styles.emptyTx}>
            <Text style={styles.emptyTxText}>{t('coinDetail.noTransactions')}</Text>
          </View>
        ) : (
          <FlatList
            data={txs}
            keyExtractor={item => item.txid}
            renderItem={({item}) => {
              const isPending = item.confirmations === 0 && item.direction === 'out';
              return (
                <TouchableOpacity
                  style={[styles.txItem, isPending && styles.txItemPending]}
                  onPress={() => navigation.navigate('TxDetail', {tx: item, coin})}>
                  <View style={styles.txInfo}>
                    <View style={styles.txDirectionRow}>
                      <Text style={styles.txDirection}>
                        {item.direction === 'in' ? t('coinDetail.received') : t('coinDetail.sent')}
                      </Text>
                      {isPending && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>{t('coinDetail.pending')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.txAddress} numberOfLines={1}>
                      {item.txid}
                    </Text>
                    {item.timestamp > 0 && (
                      <Text style={styles.txTime}>
                        {new Date(item.timestamp * 1000).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      {color: item.direction === 'in' ? colors.success : colors.error},
                    ]}>
                    {item.direction === 'in' ? '+' : '-'}
                    {formatCoinBalance(item.amount, coin)}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonOutline, {borderColor: color}]}
          onPress={() => navigation.navigate('SwapTab', {screen: 'SwapList', params: {tick: config.ticker}})}>
          <Text style={[styles.actionButtonTextOutline, {color}]}>{t('coinDetail.swap')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: color}]}
          onPress={() => navigation.navigate('Send', {coin})}
          disabled={activeKey?.isWatchOnly}>
          <Text style={styles.actionButtonText}>{t('coinDetail.send')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonOutline, {borderColor: color}]}
          onPress={() => navigation.navigate('Receive', {coin})}>
          <Text style={[styles.actionButtonTextOutline, {color}]}>{t('coinDetail.receive')}</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  coinIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  coinIconText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  coinName: {
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  balance: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  address: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  actionButtonTextOutline: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  txSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  txSectionTitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  emptyTx: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  emptyTxText: {
    fontSize: fontSize.md,
    color: colors.textLight,
  },
  txItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  txItemPending: {
    borderColor: colors.warning,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  txInfo: {
    flex: 1,
  },
  txDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  txDirection: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: colors.warning + '25',
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingBadgeText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  txAddress: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  txTime: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  txAmount: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
