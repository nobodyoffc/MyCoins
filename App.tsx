import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/navigation/RootNavigator';
import {ApiPaymentHandler} from './src/components/ApiPaymentHandler';
import {FloatingAvatar} from './src/components/FloatingAvatar';
import {BackupReminder} from './src/components/BackupReminder';
import {startAppLifecycleMonitor} from './src/utils/app-lifecycle';
import {useI18nStore} from './src/i18n';

function App() {
  useEffect(() => {
    startAppLifecycleMonitor();
    useI18nStore.getState().loadLanguage();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
      <FloatingAvatar />
      <ApiPaymentHandler />
      <BackupReminder />
    </SafeAreaProvider>
  );
}

export default App;
