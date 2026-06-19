import React from 'react';
import {View, Text, StyleSheet, ScrollView, Alert} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {CoinType, Transaction} from '../coins/types';
import {COINS} from '../coins/registry';
import {formatCoinBalance, coinColor} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function TxDetailScreen({route}: any) {
  const t = useT();
  const {tx, coin} = route.params as {tx: Transaction; coin: CoinType};
  const config = COINS[coin];
  const color = coinColor(coin);

  const handleCopyTxid = () => {
    Clipboard.setString(tx.txid);
    Alert.alert(t('txDetail.copiedTitle'), t('txDetail.copiedMessage'));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, {backgroundColor: color + '15'}]}>
        <Text style={styles.directionLabel}>
          {tx.direction === 'in' ? t('txDetail.received') : t('txDetail.sent')}
        </Text>
        <Text
          style={[
            styles.amount,
            {color: tx.direction === 'in' ? colors.success : colors.error},
          ]}>
          {tx.direction === 'in' ? '+' : '-'}
          {formatCoinBalance(tx.amount, coin)} {config.ticker}
        </Text>
      </View>

      <View style={styles.details}>
        <DetailRow
          label={t('txDetail.transactionId')}
          value={tx.txid}
          mono
          onPress={handleCopyTxid}
        />
        {tx.from ? (
          <DetailRow label={t('txDetail.from')} value={tx.from} mono />
        ) : null}
        {tx.to ? (
          <DetailRow label={t('txDetail.to')} value={tx.to} mono />
        ) : null}
        {tx.fee && tx.fee !== '0' ? (
          <DetailRow
            label={t('txDetail.fee')}
            value={`${formatCoinBalance(tx.fee, coin)} ${config.ticker}`}
          />
        ) : null}
        {tx.confirmations > 0 ? (
          <DetailRow
            label={t('txDetail.confirmations')}
            value={String(tx.confirmations)}
          />
        ) : null}
        {tx.timestamp > 0 ? (
          <DetailRow
            label={t('txDetail.time')}
            value={new Date(tx.timestamp * 1000).toLocaleString()}
          />
        ) : null}
        <DetailRow
          label={t('txDetail.coin')}
          value={`${config.name} (${config.ticker})`}
        />
        <DetailRow
          label={t('txDetail.direction')}
          value={
            tx.direction === 'in'
              ? t('txDetail.incoming')
              : t('txDetail.outgoing')
          }
        />
      </View>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  mono,
  onPress,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, mono && styles.mono]}
        selectable
        onPress={onPress}
        numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  directionLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amount: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
  },
  details: {
    padding: spacing.lg,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  rowValue: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
  },
});
