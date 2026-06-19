import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SwapService} from './SwapListScreen';
import {CoinType} from '../coins/types';
import {getProvider} from '../api/api-registry';
import {sendTransaction} from '../coins/send-service';
import {verifyPassword} from '../account/account';
import {useAccountStore} from '../store/account-store';
import {useWalletStore} from '../store/wallet-store';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

// Map ticker string to CoinType
function tickerToCoinType(tick: string): CoinType | null {
  const map: Record<string, CoinType> = {
    btc: CoinType.BTC, bch: CoinType.BCH, fch: CoinType.FCH,
    doge: CoinType.DOGE, eth: CoinType.ETH, usdt: CoinType.USDT, usdc: CoinType.USDC,
  };
  return map[tick.toLowerCase()] || null;
}

export function SwapDetailScreen({route, navigation}: any) {
  const t = useT();
  const {service} = route.params as {service: SwapService};
  const p = service.params;

  const {activeKeyId, keys, currentAccount} = useAccountStore();
  const {addPendingTx, getDisplayBalance, pendingTxs, balances} = useWalletStore();
  const activeKey = keys.find(k => k.id === activeKeyId);

  const goodsCoin = tickerToCoinType(p.gTick);
  const moneyCoin = tickerToCoinType(p.mTick);
  const gTick = p.gTick.toUpperCase();
  const mTick = p.mTick.toUpperCase();

  const [gPoolRaw, setGPoolRaw] = useState<number>(0); // goods pool in satoshis
  const [mPoolRaw, setMPoolRaw] = useState<number>(0); // money pool in satoshis
  const [gDecimals, setGDecimals] = useState(8);
  const [mDecimals, setMDecimals] = useState(8);
  const [loadingPool, setLoadingPool] = useState(true);

  // Swap direction: 'buyMoney' = send goods get money, 'buyGoods' = send money get goods
  const [direction, setDirection] = useState<'buyMoney' | 'buyGoods'>('buyMoney');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [password, setPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const swapFeeRate = parseFloat(p.swapFee || '0') + parseFloat(p.serviceFee || '0');

  // Fetch pool balances
  useEffect(() => {
    fetchPoolBalances();
  }, []);

  const fetchPoolBalances = async () => {
    setLoadingPool(true);
    try {
      const {COINS} = require('../coins/registry');
      if (goodsCoin) {
        setGDecimals(COINS[goodsCoin].decimals);
        const gProvider = getProvider(goodsCoin);
        const gBal = await gProvider.getBalance(p.gAddr);
        setGPoolRaw(Number(gBal));
      }
      if (moneyCoin) {
        setMDecimals(COINS[moneyCoin].decimals);
        const mProvider = getProvider(moneyCoin);
        const mBal = await mProvider.getBalance(p.mAddr);
        setMPoolRaw(Number(mBal));
      }
    } catch (err: any) {
      console.warn('[SwapDetail] Failed to fetch pool:', err.message);
    } finally {
      setLoadingPool(false);
    }
  };

  const toHuman = (raw: number, decimals: number) => {
    if (raw === 0) return '0';
    const str = raw.toString().padStart(decimals + 1, '0');
    const int = str.slice(0, -decimals) || '0';
    const frac = str.slice(-decimals).replace(/0+$/, '');
    return frac ? `${int}.${frac}` : int;
  };

  const toRaw = (human: string, decimals: number): number => {
    const parts = human.split('.');
    const int = parts[0] || '0';
    let frac = parts[1] || '';
    frac = frac.padEnd(decimals, '0').slice(0, decimals);
    return parseInt(int + frac, 10) || 0;
  };

  // AMM calculation: x*y=k
  const calculate = (input: string) => {
    setInputAmount(input);
    const x = gPoolRaw;
    const y = mPoolRaw;
    if (x === 0 || y === 0 || !input || parseFloat(input) <= 0) {
      setOutputAmount('');
      return;
    }
    const k = x * y;
    const inDecimals = direction === 'buyMoney' ? gDecimals : mDecimals;
    const outDecimals = direction === 'buyMoney' ? mDecimals : gDecimals;
    const deltaIn = toRaw(input, inDecimals);

    if (direction === 'buyMoney') {
      // Send goods, receive money
      const newX = x + deltaIn;
      const newY = Math.floor(k / newX);
      const deltaOut = y - newY;
      const received = Math.floor(deltaOut * (1 - swapFeeRate));
      setOutputAmount(received > 0 ? toHuman(received, outDecimals) : '0');
    } else {
      // Send money, receive goods
      const newY = y + deltaIn;
      const newX = Math.floor(k / newY);
      const deltaOut = x - newX;
      const received = Math.floor(deltaOut * (1 - swapFeeRate));
      setOutputAmount(received > 0 ? toHuman(received, outDecimals) : '0');
    }
  };

  const sendTick = direction === 'buyMoney' ? gTick : mTick;
  const receiveTick = direction === 'buyMoney' ? mTick : gTick;
  const sendCoin = direction === 'buyMoney' ? goodsCoin : moneyCoin;
  const receiveCoin = direction === 'buyMoney' ? moneyCoin : goodsCoin;
  const sendAddr = direction === 'buyMoney' ? p.gAddr : p.mAddr;
  const sendDecimals = direction === 'buyMoney' ? gDecimals : mDecimals;
  const receiveDecimals = direction === 'buyMoney' ? mDecimals : gDecimals;

  // My balances
  const myGoodsRaw = goodsCoin ? getDisplayBalance(goodsCoin) : '0';
  const myMoneyRaw = moneyCoin ? getDisplayBalance(moneyCoin) : '0';
  const mySendRaw = direction === 'buyMoney' ? myGoodsRaw : myMoneyRaw;
  const myReceiveRaw = direction === 'buyMoney' ? myMoneyRaw : myGoodsRaw;

  const price = gPoolRaw > 0 && mPoolRaw > 0
    ? direction === 'buyMoney'
      ? (mPoolRaw / Math.pow(10, mDecimals)) / (gPoolRaw / Math.pow(10, gDecimals))
      : (gPoolRaw / Math.pow(10, gDecimals)) / (mPoolRaw / Math.pow(10, mDecimals))
    : 0;

  const handleSwap = () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      Alert.alert(t('common.error'), t('swapDetail.enterAmount'));
      return;
    }
    if (!sendCoin) {
      Alert.alert(t('common.error'), t('swapDetail.coinNotSupported', {tick: sendTick}));
      return;
    }
    if (activeKey?.isWatchOnly) {
      Alert.alert(t('common.error'), t('swapDetail.watchOnlyError'));
      return;
    }
    setPassword('');
    setShowConfirm(true);
  };

  const handleConfirmSwap = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('swapDetail.enterPassword'));
      return;
    }
    if (!currentAccount || !verifyPassword(password, currentAccount.id)) {
      Alert.alert(t('common.error'), t('swapDetail.incorrectPassword'));
      return;
    }
    if (!sendCoin || !activeKey?.privateKey) return;

    setShowConfirm(false);
    setSending(true);
    try {
      const result = await sendTransaction({
        coin: sendCoin,
        fromAddress: activeKey.addresses[sendCoin],
        toAddress: sendAddr,
        amount: inputAmount,
        privateKey: activeKey.privateKey,
      });

      const rawAmount = toRaw(inputAmount, sendDecimals);
      addPendingTx({
        txid: result.txid,
        coin: sendCoin,
        fromAddress: activeKey.addresses[sendCoin],
        toAddress: sendAddr,
        amount: String(rawAmount),
        fee: '0',
        timestamp: Date.now(),
        balanceAtSend: balances[sendCoin]?.balanceRaw,
      });

      Alert.alert(
        t('swapDetail.swapSubmitted'),
        t('swapDetail.swapSubmittedMsg', {inputAmount, sendTick, outputAmount, receiveTick, txid: result.txid}),
        [{text: t('common.ok'), onPress: () => navigation.goBack()}],
      );
    } catch (err: any) {
      Alert.alert(t('swapDetail.swapFailed'), err.message);
    } finally {
      setSending(false);
      setPassword('');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.pairHeader}>
        <Text style={styles.pairTitle}>{gTick} ⇄ {mTick}</Text>
        <Text style={styles.pairSub}>{p.goods} / {p.money}</Text>
      </View>

      {/* Pool info */}
      <View style={styles.poolSection}>
        <Text style={styles.sectionTitle}>{t('swapDetail.poolReserves')}</Text>
        {loadingPool ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.poolRow}>
            <View style={styles.poolItem}>
              <Text style={styles.poolTick}>{gTick}</Text>
              <Text style={styles.poolValue}>{toHuman(gPoolRaw, gDecimals)}</Text>
            </View>
            <View style={styles.poolItem}>
              <Text style={styles.poolTick}>{mTick}</Text>
              <Text style={styles.poolValue}>{toHuman(mPoolRaw, mDecimals)}</Text>
            </View>
          </View>
        )}
        {price > 0 && (
          <Text style={styles.priceText}>
            {t('swapDetail.priceLine', {sendTick, price: price.toFixed(6), receiveTick})}
          </Text>
        )}
      </View>

      {/* Direction toggle */}
      <View style={styles.directionRow}>
        <TouchableOpacity
          style={[styles.dirButton, direction === 'buyMoney' && styles.dirButtonActive]}
          onPress={() => { setDirection('buyMoney'); setInputAmount(''); setOutputAmount(''); }}>
          <Text style={[styles.dirText, direction === 'buyMoney' && styles.dirTextActive]}>
            {gTick} → {mTick}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dirButton, direction === 'buyGoods' && styles.dirButtonActive]}
          onPress={() => { setDirection('buyGoods'); setInputAmount(''); setOutputAmount(''); }}>
          <Text style={[styles.dirText, direction === 'buyGoods' && styles.dirTextActive]}>
            {mTick} → {gTick}
          </Text>
        </TouchableOpacity>
      </View>

      {/* My balances */}
      <View style={styles.myBalanceRow}>
        <View style={styles.myBalanceItem}>
          <Text style={styles.myBalanceLabel}>{t('swapDetail.myCoin', {tick: gTick})}</Text>
          <Text style={styles.myBalanceValue}>{toHuman(Number(myGoodsRaw), gDecimals)}</Text>
        </View>
        <View style={styles.myBalanceItem}>
          <Text style={styles.myBalanceLabel}>{t('swapDetail.myCoin', {tick: mTick})}</Text>
          <Text style={styles.myBalanceValue}>{toHuman(Number(myMoneyRaw), mDecimals)}</Text>
        </View>
      </View>

      {/* Swap form */}
      <View style={styles.formSection}>
        <View style={styles.sendLabelRow}>
          <Text style={styles.fieldLabel}>{t('swapDetail.youSend', {tick: sendTick})}</Text>
          <TouchableOpacity onPress={() => calculate(toHuman(Number(mySendRaw), sendDecimals))}>
            <Text style={styles.maxButton}>{t('swapDetail.max')}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={inputAmount}
          onChangeText={calculate}
          placeholder={t('swapDetail.amountPlaceholder')}
          placeholderTextColor={colors.textLight}
          keyboardType="decimal-pad"
        />

        <Text style={styles.fieldLabel}>{t('swapDetail.youReceive', {tick: receiveTick})}</Text>
        <View style={styles.outputBox}>
          <Text style={styles.outputText}>
            {outputAmount || '0'}
          </Text>
        </View>

        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>{t('swapDetail.totalFee')}</Text>
          <Text style={styles.feeValue}>{(swapFeeRate * 100).toFixed(1)}%</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>{t('swapDetail.confirmationsNeeded')}</Text>
          <Text style={styles.feeValue}>
            {direction === 'buyMoney' ? p.gConfirm : p.mConfirm}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.swapButton, sending && styles.swapButtonDisabled]}
        onPress={handleSwap}
        disabled={sending || loadingPool}>
        {sending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.swapButtonText}>
            {t('swapDetail.swapAction', {sendTick, receiveTick})}
          </Text>
        )}
      </TouchableOpacity>

      {/* Password confirmation modal */}
      {showConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{t('swapDetail.confirmSwap')}</Text>
            <Text style={styles.confirmDesc}>
              {t('swapDetail.confirmDesc', {inputAmount, sendTick, outputAmount, receiveTick})}
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={password}
              onChangeText={setPassword}
              placeholder={t('swapDetail.enterPasswordPlaceholder')}
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoFocus
            />
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSwap}>
              <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setShowConfirm(false); setPassword(''); }}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  pairHeader: {
    alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.primary + '10',
  },
  pairTitle: {fontSize: fontSize.xxl, fontWeight: 'bold', color: colors.text},
  pairSub: {fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize'},
  poolSection: {padding: spacing.lg},
  sectionTitle: {
    fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: spacing.sm,
  },
  poolRow: {flexDirection: 'row', gap: spacing.md},
  poolItem: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  poolTick: {fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs},
  poolValue: {fontSize: fontSize.lg, fontWeight: '600', color: colors.text},
  priceText: {
    fontSize: fontSize.sm, color: colors.primary, textAlign: 'center',
    marginTop: spacing.sm,
  },
  directionRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dirButton: {
    flex: 1, padding: spacing.sm, borderRadius: 8, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dirButtonActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  dirText: {fontSize: fontSize.md, fontWeight: '600', color: colors.text},
  dirTextActive: {color: colors.white},
  myBalanceRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, gap: spacing.sm,
    marginBottom: spacing.md,
  },
  myBalanceItem: {
    flex: 1, backgroundColor: colors.primary + '08', borderRadius: 8,
    padding: spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  myBalanceLabel: {fontSize: fontSize.xs, color: colors.primary, marginBottom: 2},
  myBalanceValue: {fontSize: fontSize.md, fontWeight: '600', color: colors.text},
  sendLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  maxButton: {
    fontSize: fontSize.xs, fontWeight: '600', color: colors.primary,
    backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm,
    paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  formSection: {paddingHorizontal: spacing.lg},
  fieldLabel: {
    fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    fontSize: fontSize.xl, color: colors.text, borderWidth: 1,
    borderColor: colors.border, marginBottom: spacing.md, textAlign: 'center',
  },
  outputBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
    alignItems: 'center',
  },
  outputText: {fontSize: fontSize.xl, fontWeight: '600', color: colors.success},
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  feeLabel: {fontSize: fontSize.sm, color: colors.textSecondary},
  feeValue: {fontSize: fontSize.sm, color: colors.text, fontWeight: '600'},
  swapButton: {
    backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md,
    alignItems: 'center', margin: spacing.lg,
  },
  swapButtonDisabled: {opacity: 0.6},
  swapButtonText: {color: colors.white, fontSize: fontSize.lg, fontWeight: '600'},
  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center',
    alignItems: 'center', padding: spacing.lg,
  },
  confirmBox: {
    backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl,
    width: '100%', maxWidth: 360,
  },
  confirmTitle: {fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md},
  confirmDesc: {fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.lg},
  confirmInput: {
    backgroundColor: colors.background, borderRadius: 12, padding: spacing.md,
    fontSize: fontSize.lg, color: colors.text, borderWidth: 1,
    borderColor: colors.border, marginBottom: spacing.md,
  },
  confirmButton: {
    backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.sm,
  },
  confirmButtonText: {color: colors.white, fontSize: fontSize.lg, fontWeight: '600'},
  cancelButton: {padding: spacing.md, alignItems: 'center'},
  cancelText: {color: colors.textSecondary, fontSize: fontSize.md},
});
