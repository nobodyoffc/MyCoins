import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {CoinType} from '../coins/types';

const SETTINGS_KEY = '@mycoins/settings';

interface APIEndpoint {
  baseUrl: string;
  apiKey?: string;
}

interface SettingsState {
  apiEndpoints: Partial<Record<CoinType, APIEndpoint>>;
  apiProviderTypes: Record<string, string>; // groupKey -> presetKey
  customApiUrl: string;
  autoLockMinutes: number;
  feeRates: Partial<Record<CoinType, number>>; // coin -> user fee rate (sat/koinu per byte)
  loaded: boolean;

  // Actions
  setApiEndpoint: (coin: CoinType, endpoint: APIEndpoint) => void;
  setApiProviderType: (groupKey: string, presetKey: string) => void;
  setCustomApiUrl: (url: string) => void;
  setAutoLockMinutes: (minutes: number) => void;
  setFeeRate: (coin: CoinType, rate: number) => void;
  getApiEndpoint: (coin: CoinType) => APIEndpoint | undefined;
  getFeeRate: (coin: CoinType) => number | undefined;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiEndpoints: {},
  apiProviderTypes: {},
  customApiUrl: '',
  autoLockMinutes: 5,
  feeRates: {},
  loaded: false,

  setApiEndpoint: (coin, endpoint) => {
    set(state => ({
      apiEndpoints: {...state.apiEndpoints, [coin]: endpoint},
    }));
    get().saveSettings();
  },

  setApiProviderType: (groupKey, presetKey) => {
    set(state => ({
      apiProviderTypes: {...state.apiProviderTypes, [groupKey]: presetKey},
    }));
    get().saveSettings();
  },

  setCustomApiUrl: (url) => {
    set({customApiUrl: url});
    get().saveSettings();
  },

  setAutoLockMinutes: (minutes) => {
    set({autoLockMinutes: minutes});
    get().saveSettings();
  },

  setFeeRate: (coin, rate) => {
    set(state => ({
      feeRates: {...state.feeRates, [coin]: rate},
    }));
    get().saveSettings();
  },

  getApiEndpoint: (coin) => {
    return get().apiEndpoints[coin];
  },

  getFeeRate: (coin) => {
    return get().feeRates[coin];
  },

  loadSettings: async () => {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (json) {
        const data = JSON.parse(json);
        set({
          apiEndpoints: data.apiEndpoints || {},
          apiProviderTypes: data.apiProviderTypes || {},
          customApiUrl: data.customApiUrl || '',
          autoLockMinutes: data.autoLockMinutes ?? 5,
          feeRates: data.feeRates || {},
          loaded: true,
        });
      } else {
        set({loaded: true});
      }
    } catch {
      set({loaded: true});
    }
  },

  saveSettings: async () => {
    const {apiEndpoints, apiProviderTypes, customApiUrl, autoLockMinutes, feeRates} = get();
    try {
      await AsyncStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({apiEndpoints, apiProviderTypes, customApiUrl, autoLockMinutes, feeRates}),
      );
    } catch {
      // Silently fail
    }
  },
}));
