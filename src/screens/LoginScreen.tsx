import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AppState,
  InteractionManager,
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
  const inputRef = useRef<TextInput>(null);

  // Focus the field ourselves instead of using `autoFocus`. This screen is
  // usually mounted while the Activity window is still gaining focus (cold
  // start, or auto-lock on resume). Some ROMs — notably Honor/MagicOS with its
  // secure password keyboard — then bind the IME to a stale connection: the
  // keyboard shows but typed characters never reach the field, and tapping
  // doesn't help because the field is already focused.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focusSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => inputRef.current?.focus(), 350);
    };
    const task = InteractionManager.runAfterInteractions(focusSoon);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        focusSoon();
      } else {
        inputRef.current?.blur();
      }
    });
    return () => {
      task.cancel();
      sub.remove();
      clearTimeout(timer);
    };
  }, []);

  // If the field is already focused when tapped, the IME connection may be the
  // dead one described above; blur and refocus to force a fresh connection.
  const handlePressIn = () => {
    const input = inputRef.current;
    if (input?.isFocused()) {
      input.blur();
      setTimeout(() => input.focus(), 50);
    }
  };

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
          ref={inputRef}
          secureTextEntry
          autoComplete="off"
          importantForAutofill="no"
          onPressIn={handlePressIn}
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
