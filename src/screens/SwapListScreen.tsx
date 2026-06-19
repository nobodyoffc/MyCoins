import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getFCHLegacyApi} from '../api/api-registry';
import {Avatar} from '../components/Avatar';
import {formatAddress} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

interface SwapParams {
  goods: string;
  money: string;
  gTick: string;
  mTick: string;
  gAddr: string;
  mAddr: string;
  swapFee: string;
  serviceFee: string;
  gConfirm: string;
  mConfirm: string;
  curve: string;
}

export interface SwapService {
  id: string;
  stdName: string;
  desc: string;
  type: string;
  owner: string;
  dealer: string;
  active: boolean;
  tRate: number;
  tCdd: number;
  birthTime: number;
  params: SwapParams;
}

export function SwapListScreen({navigation, route}: any) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const tick = route.params?.tick as string | undefined;
  const [services, setServices] = useState<SwapService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const api = getFCHLegacyApi();
      const data = await api.searchSwapServices(tick);
      const parsed: SwapService[] = data
        .map((s: any) => {
          const params = typeof s.params === 'string' ? JSON.parse(s.params) : s.params;
          return {
            id: s.id,
            stdName: s.stdName || '',
            desc: s.desc || '',
            type: s.type || '',
            owner: s.owner || '',
            dealer: s.dealer || '',
            active: s.active !== false,
            tRate: s.tRate || 0,
            tCdd: s.tCdd || 0,
            birthTime: s.birthTime || 0,
            params,
          };
        })
        .filter((s: any) =>
          s.params?.gTick && s.params?.mTick && s.params?.gAddr && s.params?.mAddr
        );
      setServices(parsed);
    } catch (err: any) {
      console.warn('[SwapList] Failed to fetch:', err.message);
    } finally {
      setLoading(false);
    }
  }, [tick]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const totalFee = (s: SwapService) => {
    const swap = parseFloat(s.params.swapFee || '0');
    const service = parseFloat(s.params.serviceFee || '0');
    return ((swap + service) * 100).toFixed(1) + '%';
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, {paddingTop: insets.top + spacing.lg}]}>{t('swapList.title')}</Text>
      <Text style={styles.subtitle}>{t('swapList.subtitle')}</Text>

      {loading && services.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchServices} />
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('SwapDetail', {service: item})}>
              {/* Row 1: Pair + Fee */}
              <View style={styles.cardHeader}>
                <View style={styles.pairContainer}>
                  <Text style={styles.ticker}>{item.params.gTick.toUpperCase()}</Text>
                  <Text style={styles.arrow}> ⇄ </Text>
                  <Text style={styles.ticker}>{item.params.mTick.toUpperCase()}</Text>
                </View>
                <Text style={styles.fee}>{t('swapList.fee', {amount: totalFee(item)})}</Text>
              </View>

              {/* Row 2: Name + ID */}
              <View style={styles.nameRow}>
                {item.stdName ? (
                  <Text style={styles.serviceName} numberOfLines={1}>{item.stdName}</Text>
                ) : null}
                <Text style={styles.serviceId}>{formatAddress(item.id, 6, 4)}</Text>
              </View>

              {/* Row 3: Avatars + addresses */}
              <View style={styles.avatarRow}>
                <View style={styles.avatarItem}>
                  <Avatar address={item.dealer} size={36} />
                  <View style={styles.avatarInfo}>
                    <Text style={styles.avatarLabel}>{t('swapList.dealer')}</Text>
                    <Text style={styles.avatarAddr}>{formatAddress(item.dealer, 6, 4)}</Text>
                  </View>
                </View>
                <View style={styles.avatarItem}>
                  <Avatar address={item.owner} size={24} />
                  <View style={styles.avatarInfo}>
                    <Text style={styles.avatarLabel}>{t('swapList.owner')}</Text>
                    <Text style={styles.avatarAddr}>{formatAddress(item.owner, 6, 4)}</Text>
                  </View>
                </View>
              </View>

              {/* Row 4: Stats */}
              <View style={styles.statsRow}>
                <Text style={styles.statText}>
                  {t('swapList.rating', {value: item.tRate ?? '-'})}
                </Text>
                <Text style={styles.statText}>
                  {t('swapList.cdd', {value: item.tCdd || 0})}
                </Text>
                <Text style={styles.statText}>
                  {t('swapList.since', {date: item.birthTime > 0
                    ? new Date(item.birthTime * 1000).toLocaleDateString()
                    : '-'})}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('swapList.empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pairContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticker: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  arrow: {
    fontSize: fontSize.lg,
    color: colors.primary,
  },
  fee: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  serviceName: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  serviceId: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontFamily: 'monospace',
    marginLeft: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  avatarItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarInfo: {
    marginLeft: spacing.sm,
  },
  avatarLabel: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  avatarAddr: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  statText: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textLight,
  },
});
