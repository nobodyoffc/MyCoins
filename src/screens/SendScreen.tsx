import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {CoinType} from '../coins/types';
import {COINS} from '../coins/registry';
import {sendTransaction, getMinFeeRate, DEFAULT_FEE_RATES, estimateUtxoFee} from '../coins/send-service';
import {useAccountStore} from '../store/account-store';
import {useWalletStore} from '../store/wallet-store';
import {useSettingsStore} from '../store/settings-store';
import {verifyPassword} from '../account/account';
import {formatCoinBalance, coinColor} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function SendScreen({route, navigation}: any) {
  const t = useT();
  const {coin} = route.params as {coin: CoinType};
  const config = COINS[coin];
  const color = coinColor(coin);

  const {activeKeyId, keys, currentAccount} = useAccountStore();
  const {balances, addPendingTx} = useWalletStore();
  const {getFeeRate} = useSettingsStore();

  const activeKey = keys.find(k => k.id === activeKeyId);
  const balance = balances[coin];

  const isUtxo = config.model === 'utxo';
  const minFeeRate = getMinFeeRate(coin);
  const defaultFeeRate = isUtxo
    ? getFeeRate(coin) ?? DEFAULT_FEE_RATES[coin] ?? minFeeRate
    : 0;

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdvancedFee, setShowAdvancedFee] = useState(false);
  const [feeRateInput, setFeeRateInput] = useState(String(defaultFeeRate));

  // Rate that will actually be used: the typed value (or default), clamped to the
  // network floor. send-service applies the same clamp, so the preview can't lie.
  const parsedRate = Number(feeRateInput.trim());
  const chosenRate =
    Number.isInteger(parsedRate) && parsedRate > 0 ? parsedRate : defaultFeeRate;
  const effectiveFeeRate = Math.max(chosenRate, minFeeRate);
  // Estimate for a typical 1-input / 2-output transaction.
  const estFeeRaw = String(estimateUtxoFee(effectiveFeeRate));

  const handleSend = async () => {
    if (!recipient.trim()) {
      Alert.alert(t('common.error'), t('send.enterRecipient'));
      return;
    }
    if (!amount.trim() || parseFloat(amount) <= 0) {
      Alert.alert(t('common.error'), t('send.enterValidAmount'));
      return;
    }
    if (activeKey?.isWatchOnly) {
      Alert.alert(t('common.error'), t('send.watchOnly'));
      return;
    }

    // Show password confirmation modal
    setPassword('');
    setShowPasswordModal(true);
  };

  const handleConfirmSend = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('send.enterPassword'));
      return;
    }

    // Verify password matches the current account
    if (!currentAccount || !verifyPassword(password, currentAccount.id)) {
      Alert.alert(t('common.error'), t('send.incorrectPassword'));
      return;
    }

    setShowPasswordModal(false);
    setLoading(true);
    try {
      const amountStr = amount.trim();
      const result = await sendTransaction({
        coin,
        fromAddress: balance.address,
        toAddress: recipient.trim(),
        amount: amountStr,
        privateKey: activeKey!.privateKey!,
        feeRate: isUtxo ? effectiveFeeRate : undefined,
      });

      // Add as pending TX for optimistic UI update
      const decimals = config.decimals;
      const parts = amountStr.split('.');
      const intPart = parts[0] || '0';
      let fracPart = parts[1] || '';
      fracPart = fracPart.padEnd(decimals, '0').slice(0, decimals);
      const rawAmount = intPart + fracPart;

      addPendingTx({
        txid: result.txid,
        coin,
        fromAddress: balance.address,
        toAddress: recipient.trim(),
        amount: rawAmount,
        fee: isUtxo ? estFeeRaw : '0', // estimate for UTXO; exact fee depends on inputs selected
        timestamp: Date.now(),
        balanceAtSend: balance.balanceRaw,
      });

      Alert.alert(
        t('send.transactionSent'),
        t('send.txid', {txid: result.txid}),
        [{text: t('common.ok'), onPress: () => navigation.goBack()}],
      );
    } catch (err: any) {
      Alert.alert(t('send.sendFailed'), err.message);
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, {backgroundColor: color + '15'}]}>
        <Text style={styles.coinName}>
          {t('send.sendCoin', {name: config.name})}
        </Text>
        <Text style={styles.balance}>
          {t('send.available', {
            balance: formatCoinBalance(balance.balanceRaw, coin),
            ticker: config.ticker,
          })}
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>{t('send.recipientAddress')}</Text>
        <TextInput
          style={[styles.input, styles.monoInput]}
          value={recipient}
          onChangeText={setRecipient}
          placeholder={t('send.enterAddress', {ticker: config.ticker})}
          placeholderTextColor={colors.textLight}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('send.amountLabel', {ticker: config.ticker})}</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textLight}
          keyboardType="decimal-pad"
        />

        {isUtxo && (
          <View style={styles.feeInfo}>
            <View style={styles.feeHeader}>
              <Text style={styles.feeLabel}>{t('send.feeRate')}</Text>
              <TouchableOpacity onPress={() => setShowAdvancedFee(v => !v)}>
                <Text style={[styles.feeAdvancedToggle, {color}]}>{t('send.feeAdvanced')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.feeValue}>
              {effectiveFeeRate}/byte · {t('send.feeEstimate', {
                fee: formatCoinBalance(estFeeRaw, coin),
                ticker: config.ticker,
              })}
            </Text>

            {showAdvancedFee ? (
              <>
                <Text style={styles.feeCustomLabel}>{t('send.feeCustomLabel')}</Text>
                <TextInput
                  style={styles.feeRateInput}
                  value={feeRateInput}
                  onChangeText={v => setFeeRateInput(v.replace(/[^0-9]/g, ''))}
                  placeholder={String(defaultFeeRate)}
                  placeholderTextColor={colors.textLight}
                  keyboardType="number-pad"
                />
                <Text style={styles.feeMinNote}>{t('send.feeMinNote', {min: minFeeRate})}</Text>
              </>
            ) : (
              <Text style={styles.feeMinNote}>{t('send.feeUsesDefault')}</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, {backgroundColor: color}, loading && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{t('send.sendTicker', {ticker: config.ticker})}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('send.confirmPassword')}</Text>
            <Text style={styles.modalDesc}>
              {t('send.sendTo', {amount, ticker: config.ticker})}
            </Text>
            <Text style={styles.modalAddress} numberOfLines={2}>
              {recipient}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={password}
              onChangeText={setPassword}
              placeholder={t('send.passwordPlaceholder')}
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoFocus
              onSubmitEditing={handleConfirmSend}
            />
            <TouchableOpacity
              style={[styles.modalSendButton, {backgroundColor: color}]}
              onPress={handleConfirmSend}>
              <Text style={styles.modalSendButtonText}>{t('send.confirmSend')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowPasswordModal(false);
                setPassword('');
              }}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  balance: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    padding: spacing.lg,
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
    fontSize: fontSize.lg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  monoInput: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
  },
  feeInfo: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  feeLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  feeAdvancedToggle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  feeValue: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  feeCustomLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  feeRateInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: 'monospace',
  },
  feeMinNote: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  button: {
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
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
  modalDesc: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalAddress: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  modalSendButton: {
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalSendButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  modalCancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
