import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {CoinType} from '../coins/types';

const ERC20_COINS: CoinType[] = [CoinType.USDT, CoinType.USDC];
import {COINS} from '../coins/registry';
import {formatAddress, coinColor} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

interface Props {
  coin: CoinType;
  balance: string;
  address: string;
  onPress: () => void;
}

export function CoinBalanceCard({coin, balance, address, onPress}: Props) {
  const config = COINS[coin];
  const color = coinColor(coin);
  const t = useT();
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => setToastVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  const handleCopyAddress = () => {
    Clipboard.setString(address);
    setToastVisible(true);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.iconContainer, {backgroundColor: color + '20'}]}>
        <Text style={[styles.iconText, {color}]}>{config.ticker}</Text>
        {ERC20_COINS.includes(coin) && (
          <Text style={styles.chainLabel}>ETH</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{config.name}</Text>
        <Text style={styles.address} onPress={handleCopyAddress}>
          {formatAddress(address)}
        </Text>
      </View>
      <View style={styles.balanceContainer}>
        <Text style={styles.balance} numberOfLines={1}>
          {balance}
        </Text>
        <Text style={styles.ticker}>{config.ticker}</Text>
      </View>
      {toastVisible && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{t('components.balanceCard.copied')}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
  },
  chainLabel: {
    fontSize: 8,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  address: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  balanceContainer: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  balance: {
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: '600',
    maxWidth: 120,
  },
  ticker: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toastContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2000,
  },
  toast: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  toastText: {
    color: '#fff',
    fontSize: fontSize.md,
  },
});
