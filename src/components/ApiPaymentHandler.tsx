import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ActivityIndicator} from 'react-native';
import {
  setOnApiCreditEvent,
  ApiCreditEvent,
  fchToSatoshis,
} from '../api/providers/common-api';
import {getFCHCommonApi} from '../api/api-registry';
import {buildFchTransaction} from '../coins/fch/tx-builder';
import {useAccountStore} from '../store/account-store';
import {TxInput} from '../coins/utxo-common';
import {UTXO} from '../coins/types';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

/**
 * Listens for FCH API credit events:
 *  - 'low': balance reached half the credit limit — suggest a top-up.
 *  - 'exhausted': credit ran out (code 1004) — charged calls are blocked.
 * In both cases it can build, sign and broadcast a top-up TX using the FREE
 * GET cashValid/broadcastTx endpoints, which work even when credit is gone.
 */
export function ApiPaymentHandler() {
  const [event, setEvent] = useState<ApiCreditEvent | null>(null);
  const [utxos, setUtxos] = useState<UTXO[] | null>(null);
  const [loadingCashes, setLoadingCashes] = useState(false);
  const [paying, setPaying] = useState(false);
  const {keys, activeKeyId} = useAccountStore();
  const t = useT();

  useEffect(() => {
    setOnApiCreditEvent(ev => setEvent(ev));
    return () => setOnApiCreditEvent(null);
  }, []);

  const activeKey = keys.find(k => k.id === activeKeyId);

  // When an event arrives, fetch the user's cashes via the free GET endpoint so
  // we can offer a one-tap top-up even when credit is exhausted.
  useEffect(() => {
    if (!event || !activeKey) {
      setUtxos(null);
      return;
    }
    let cancelled = false;
    setLoadingCashes(true);
    getFCHCommonApi()
      .fetchValidCashesFree(activeKey.id)
      .then(list => {
        if (!cancelled) setUtxos(list);
      })
      .catch(() => {
        if (!cancelled) setUtxos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCashes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event, activeKey]);

  if (!event) return null;

  const isExhausted = event.kind === 'exhausted';
  const hasUtxos = !!utxos && utxos.length > 0;
  const canAutoPay = hasUtxos && !!activeKey?.privateKey;

  const handleTopUp = async () => {
    if (!activeKey?.privateKey || !utxos || utxos.length === 0) return;

    setPaying(true);
    try {
      const amountSats = fchToSatoshis(event.minPayment);

      const txInputs: TxInput[] = utxos.map(u => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        scriptPubKey: u.scriptPubKey,
      }));

      // Build and sign a TX paying the dealer to (re)buy the service.
      const result = buildFchTransaction({
        utxos: txInputs,
        recipients: [{address: event.dealer, value: amountSats}],
        changeAddress: activeKey.id, // FCH address of active key
        feeRate: 1,
        privateKey: activeKey.privateKey,
      });

      // Broadcast via the FREE GET endpoint — works even when credit is gone.
      const txid = await getFCHCommonApi().broadcastRawFree(result.rawHex);

      Alert.alert(
        t('components.apiPayment.paymentSentTitle'),
        t('components.apiPayment.paymentSentMessage', {
          amount: event.minPayment,
          dealer: event.dealer,
          txid: txid || result.txid,
        }) +
          '\n\n' +
          t('components.apiPayment.confirmWait'),
      );
      setEvent(null);
    } catch (err: any) {
      Alert.alert(
        t('components.apiPayment.paymentFailedTitle'),
        err.message || t('components.apiPayment.unknownError'),
      );
    } finally {
      setPaying(false);
    }
  };

  const handleDismiss = () => {
    setEvent(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={[styles.title, !isExhausted && styles.titleLow]}>
            {isExhausted
              ? t('components.apiPayment.title')
              : t('components.apiPayment.lowTitle')}
          </Text>

          <Text style={styles.desc}>
            {isExhausted
              ? t('components.apiPayment.desc', {amount: event.minPayment})
              : t('components.apiPayment.lowDesc', {amount: event.minPayment})}
          </Text>

          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>{t('components.apiPayment.dealerAddress')}</Text>
            <Text style={styles.address} selectable>{event.dealer}</Text>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>{t('components.apiPayment.minimumPayment')}</Text>
            <Text style={styles.amount}>{event.minPayment} FCH</Text>
          </View>

          {loadingCashes ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>
                {t('components.apiPayment.checkingFunds')}
              </Text>
            </View>
          ) : canAutoPay ? (
            <>
              <Text style={styles.autoPayHint}>
                {t('components.apiPayment.autoPayHint')}
              </Text>
              <TouchableOpacity
                style={styles.payButton}
                onPress={handleTopUp}
                disabled={paying}>
                {paying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.payButtonText}>
                    {isExhausted
                      ? t('components.apiPayment.payNow', {amount: event.minPayment})
                      : t('components.apiPayment.topUpNow', {amount: event.minPayment})}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.manualHint}>
              {t('components.apiPayment.manualHintPrefix')}
              <Text style={styles.bold}>{event.minPayment} FCH</Text>
              {t('components.apiPayment.manualHintMiddle')}
              <Text style={[styles.bold, {fontFamily: 'monospace', fontSize: fontSize.xs}]}>
                {event.dealer}
              </Text>
              {t('components.apiPayment.manualHintSuffix')}
            </Text>
          )}

          <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
            <Text style={styles.dismissText}>
              {isExhausted
                ? t('components.apiPayment.dismiss')
                : t('components.apiPayment.later')}
            </Text>
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
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: spacing.md,
  },
  titleLow: {
    color: colors.primary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  desc: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  bold: {
    fontWeight: 'bold',
  },
  addressBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  address: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: colors.text,
  },
  amountBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primary,
  },
  autoPayHint: {
    fontSize: fontSize.sm,
    color: colors.success,
    marginBottom: spacing.md,
  },
  manualHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  payButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  dismissButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
});
