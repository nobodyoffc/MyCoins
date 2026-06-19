/**
 * App lifecycle management for security.
 * Clears decrypted keys when app goes to background,
 * requires re-login after timeout.
 */

import {AppState, AppStateStatus} from 'react-native';
import {useAccountStore} from '../store/account-store';
import {useWalletStore} from '../store/wallet-store';
import {useSettingsStore} from '../store/settings-store';

let backgroundTimestamp: number | null = null;
let appStateSubscription: any = null;

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'background' || nextState === 'inactive') {
    backgroundTimestamp = Date.now();
  } else if (nextState === 'active' && backgroundTimestamp) {
    const elapsed = Date.now() - backgroundTimestamp;
    const autoLockMs = useSettingsStore.getState().autoLockMinutes * 60 * 1000;

    if (elapsed > autoLockMs) {
      // Auto-lock: clear keys and require re-login
      useWalletStore.getState().clearWallet();
      useAccountStore.getState().logout();
    }

    backgroundTimestamp = null;
  }
}

export function startAppLifecycleMonitor() {
  if (appStateSubscription) {
    return;
  }
  appStateSubscription = AppState.addEventListener(
    'change',
    handleAppStateChange,
  );
}

export function stopAppLifecycleMonitor() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
