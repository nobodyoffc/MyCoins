import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useAccountStore} from '../store/account-store';
import {KeystoreManager} from '../account/keystore';
import {FileSystemStorage} from '../account/fs-storage';
import {initializeProviders} from '../api/api-registry';
import {useSettingsStore} from '../store/settings-store';
import {CoinType} from '../coins/types';
import {navigationRef} from './navigationRef';

const DEFAULT_FCH_API = 'https://freecash.info/APIP';

// Screens
import {LoginScreen} from '../screens/LoginScreen';
import {CreateAccountScreen} from '../screens/CreateAccountScreen';
import {KeyListScreen} from '../screens/KeyListScreen';
import {AddKeyScreen} from '../screens/AddKeyScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {CoinDetailScreen} from '../screens/CoinDetailScreen';
import {SendScreen} from '../screens/SendScreen';
import {ReceiveScreen} from '../screens/ReceiveScreen';
import {TxDetailScreen} from '../screens/TxDetailScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {SwapListScreen} from '../screens/SwapListScreen';
import {SwapDetailScreen} from '../screens/SwapDetailScreen';

import {BackHandler} from 'react-native';
import {colors} from '../utils/theme';
import {CoinsIcon, SwapIcon, SettingsIcon, BackIcon} from '../components/TabIcons';
import {useT} from '../i18n';

const AuthStack = createNativeStackNavigator();
const WalletStack = createNativeStackNavigator();
const KeysStack = createNativeStackNavigator();
const SwapStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function WalletNavigator() {
  const t = useT();
  return (
    <WalletStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.surface},
        headerTintColor: colors.text,
      }}>
      <WalletStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{headerShown: false}}
      />
      <WalletStack.Screen
        name="CoinDetail"
        component={CoinDetailScreen}
        options={({route}: any) => ({
          title: route.params?.coin || t('nav.coin'),
        })}
      />
      <WalletStack.Screen
        name="Send"
        component={SendScreen}
        options={{title: t('nav.send')}}
      />
      <WalletStack.Screen
        name="Receive"
        component={ReceiveScreen}
        options={{title: t('nav.receive')}}
      />
      <WalletStack.Screen
        name="TxDetail"
        component={TxDetailScreen}
        options={{title: t('nav.transaction')}}
      />
    </WalletStack.Navigator>
  );
}

function KeysNavigator() {
  const t = useT();
  return (
    <KeysStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.surface},
        headerTintColor: colors.text,
      }}>
      <KeysStack.Screen
        name="KeyList"
        component={KeyListScreen}
        options={{headerShown: false}}
      />
      <KeysStack.Screen
        name="AddKey"
        component={AddKeyScreen}
        options={{title: t('nav.addKey')}}
      />
    </KeysStack.Navigator>
  );
}

function SwapNavigator() {
  const t = useT();
  return (
    <SwapStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.surface},
        headerTintColor: colors.text,
      }}>
      <SwapStack.Screen
        name="SwapList"
        component={SwapListScreen}
        options={{headerShown: false}}
      />
      <SwapStack.Screen
        name="SwapDetail"
        component={SwapDetailScreen}
        options={{title: t('nav.swap')}}
      />
    </SwapStack.Navigator>
  );
}

// Placeholder for the Back tab — it never renders since tabPress navigates back.
function BackPlaceholder() {
  return null;
}

function MainTabs() {
  const t = useT();
  return (
    <Tab.Navigator
      initialRouteName="WalletTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {backgroundColor: colors.surface, borderTopColor: colors.border},
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
      }}>
      {/* Keys is reachable by tapping the avatar/FID, so it's hidden from the tab bar. */}
      <Tab.Screen
        name="KeysTab"
        component={KeysNavigator}
        options={{tabBarItemStyle: {display: 'none'}}}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('nav.tabSettings'),
          headerShown: false,
          tabBarIcon: ({color, size}) => <SettingsIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="SwapTab"
        component={SwapNavigator}
        options={{
          tabBarLabel: t('nav.tabSwap'),
          tabBarIcon: ({color, size}) => <SwapIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletNavigator}
        options={{
          tabBarLabel: t('nav.tabCoins'),
          tabBarIcon: ({color, size}) => <CoinsIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="BackTab"
        component={BackPlaceholder}
        options={{
          tabBarLabel: t('nav.tabBack'),
          tabBarIcon: ({color, size}) => <BackIcon color={color} size={size} />,
        }}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            // The Keys page is reached from the avatar (no history entry),
            // so Back from it should return to the Coins page.
            const rootRoute = navigationRef.getCurrentRoute();
            const tabState = navigationRef.getRootState();
            const activeTab = tabState?.routes[tabState.index]?.name;
            if (activeTab === 'KeysTab' && rootRoute?.name === 'KeyList') {
              navigationRef.navigate('WalletTab' as never);
              return;
            }
            // The Coins page (Dashboard) is the app's home; Back from it
            // closes the app rather than returning to a previous tab.
            if (activeTab === 'WalletTab' && rootRoute?.name === 'Dashboard') {
              BackHandler.exitApp();
              return;
            }
            if (navigationRef.canGoBack()) {
              navigationRef.goBack();
            }
          },
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const {isLoggedIn, setKeystoreManager} = useAccountStore();
  const {loadSettings, customApiUrl} = useSettingsStore();

  useEffect(() => {
    const storage = new FileSystemStorage();
    const keystoreManager = new KeystoreManager(storage);
    setKeystoreManager(keystoreManager);
    loadSettings().then(() => {
      const settings = useSettingsStore.getState();
      const btcEndpoint = settings.apiEndpoints[CoinType.BTC];
      const dogeEndpoint = settings.apiEndpoints[CoinType.DOGE];
      const bchEndpoint = settings.apiEndpoints[CoinType.BCH];
      const ethEndpoint = settings.apiEndpoints[CoinType.ETH];
      // apiProviderTypes is keyed by the lowercase settings group key
      // ('btc'/'doge'/'bch'), not the CoinType value. The saved baseUrl always
      // matches the saved provider type, so initializeProviders can pick the
      // right class and URL together.
      initializeProviders({
        fchBaseUrl: settings.customApiUrl || DEFAULT_FCH_API,
        btcProviderType: settings.apiProviderTypes.btc,
        btcBaseUrl: btcEndpoint?.baseUrl,
        btcApiKey: btcEndpoint?.apiKey,
        dogeProviderType: settings.apiProviderTypes.doge,
        dogeBaseUrl: dogeEndpoint?.baseUrl,
        dogeApiKey: dogeEndpoint?.apiKey,
        bchProviderType: settings.apiProviderTypes.bch,
        bchBaseUrl: bchEndpoint?.baseUrl,
        bchApiKey: bchEndpoint?.apiKey,
        ethRpcUrl: ethEndpoint?.baseUrl,
        etherscanApiKey: ethEndpoint?.apiKey,
      });
    });
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      {isLoggedIn ? (
        <MainTabs />
      ) : (
        <AuthStack.Navigator screenOptions={{headerShown: false}}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen
            name="CreateAccount"
            component={CreateAccountScreen}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
