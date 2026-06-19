import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountStore} from '../store/account-store';
import {useWalletStore} from '../store/wallet-store';
import {CoinBalanceCard} from '../components/CoinBalanceCard';
import {CoinType} from '../coins/types';
import {isCoinHidden} from '../coins/registry';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

const COIN_ORDER: CoinType[] = [
  CoinType.BTC,
  CoinType.ETH,
  CoinType.BCH,
  CoinType.FCH,
  CoinType.DOGE,
  CoinType.USDT,
  CoinType.USDC,
].filter(c => !isCoinHidden(c));

export function DashboardScreen({navigation}: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const {activeKeyId, keys} = useAccountStore();
  const {balances, isLoading, initializeForKey, refreshBalances, getDisplayBalanceText, pendingTxs} = useWalletStore();

  const activeKey = keys.find(k => k.id === activeKeyId);

  useEffect(() => {
    if (activeKey) {
      initializeForKey(activeKey.addresses);
      // Auto-refresh on key change
      setTimeout(() => refreshBalances(), 100);
    }
  }, [activeKeyId]);

  const handleCoinPress = (coin: CoinType) => {
    navigation.navigate('CoinDetail', {coin});
  };

  const handleRefresh = () => {
    refreshBalances();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top + spacing.lg}]}>
        <Text style={styles.title}>{t('dashboard.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }>
        {COIN_ORDER.map(coin => {
          const b = balances[coin];
          return (
            <CoinBalanceCard
              key={coin}
              coin={coin}
              balance={getDisplayBalanceText(coin)}
              address={b.address}
              onPress={() => handleCoinPress(coin)}
            />
          );
        })}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: 0,
  },
});
