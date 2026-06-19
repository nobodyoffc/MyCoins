import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountStore} from '../store/account-store';
import {deriveAccountId} from '../account/account';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function CreateAccountScreen({navigation, route}: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const initialPassword = route?.params?.password || '';
  const [password, setPassword] = useState(initialPassword);
  const [confirmPassword, setConfirmPassword] = useState(initialPassword);
  const [loading, setLoading] = useState(false);
  const {createNewAccount} = useAccountStore();

  const accountId = password ? deriveAccountId(password) : '';

  const handleCreate = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('createAccount.enterPassword'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('createAccount.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await createNewAccount(password);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top + spacing.lg}]}>
      <Text style={styles.title}>{t('createAccount.title')}</Text>
      <Text style={styles.description}>
        {t('createAccount.description')}
      </Text>

      <Text style={styles.label}>{t('createAccount.passwordLabel')}</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t('createAccount.passwordPlaceholder')}
        placeholderTextColor={colors.textLight}
        secureTextEntry
        autoFocus
      />

      <Text style={styles.label}>{t('createAccount.confirmPasswordLabel')}</Text>
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t('createAccount.confirmPasswordPlaceholder')}
        placeholderTextColor={colors.textLight}
        secureTextEntry
      />

      {accountId ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>{t('createAccount.accountIdLabel')}</Text>
          <Text style={styles.previewValue}>{accountId}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>{t('createAccount.createButton')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>{t('createAccount.backToLogin')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 20,
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
    marginBottom: spacing.md,
  },
  previewBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  previewLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  previewValue: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  backButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
  },
});
