import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountStore} from '../store/account-store';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

export function LoginScreen({navigation}: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const {login} = useAccountStore();

  const handleLogin = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('login.enterPassword'));
      return;
    }
    setLoading(true);
    try {
      const success = await login(password);
      if (!success) {
        Alert.alert(t('common.error'), t('login.noAccountFound'), [
          {text: t('common.cancel'), style: 'cancel'},
          {text: t('login.create'), onPress: () => navigation.navigate('CreateAccount', {password})},
        ]);
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.title}>MyCoins</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

      </View>

      <View style={styles.form}>
        <Text style={styles.label}>{t('login.password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('login.passwordPlaceholder')}
          placeholderTextColor={colors.textLight}
          secureTextEntry
          autoFocus
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{t('login.login')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('CreateAccount')}>
          <Text style={styles.secondaryButtonText}>{t('login.createNewAccount')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl * 2,
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    marginBottom: spacing.xl,
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
  secondaryButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
