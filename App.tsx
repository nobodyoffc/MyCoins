import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/navigation/RootNavigator';
import {ApiPaymentHandler} from './src/components/ApiPaymentHandler';
import {FloatingAvatar} from './src/components/FloatingAvatar';
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
    </SafeAreaProvider>
  );
}

export default App;
