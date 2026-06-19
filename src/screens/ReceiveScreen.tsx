import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import {CoinType} from '../coins/types';
import {COINS} from '../coins/registry';
import {useWalletStore} from '../store/wallet-store';
import {coinColor} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function ReceiveScreen({route}: any) {
  const t = useT();
  const {coin} = route.params as {coin: CoinType};
  const config = COINS[coin];
  const color = coinColor(coin);

  const {balances} = useWalletStore();
  const address = balances[coin].address;

  const handleCopy = () => {
    Clipboard.setString(address);
    Alert.alert(t('common.copied'), t('receive.copiedMessage'));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: address,
        title: t('receive.shareTitle', {ticker: config.ticker}),
      });
    } catch {
      // User cancelled
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, {backgroundColor: color + '15'}]}>
        <Text style={styles.coinName}>{t('receive.title', {coin: config.name})}</Text>
      </View>

      <View style={styles.qrContainer}>
        {address ? (
          <QRCode value={address} size={200} backgroundColor="transparent" />
        ) : (
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrPlaceholderText}>{t('receive.noAddress')}</Text>
          </View>
        )}
      </View>

      <View style={styles.addressContainer}>
        <Text style={styles.addressLabel}>{t('receive.addressLabel', {ticker: config.ticker})}</Text>
        <Text style={styles.address} selectable>
          {address}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, {backgroundColor: color}]}
          onPress={handleCopy}>
          <Text style={styles.buttonText}>{t('receive.copyAddress')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonOutline, {borderColor: color}]}
          onPress={handleShare}>
          <Text style={[styles.buttonTextOutline, {color}]}>{t('receive.share')}</Text>
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
  },
  coinName: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    color: colors.textLight,
  },
  addressContainer: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  address: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  buttonTextOutline: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
