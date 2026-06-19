import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSystemLocale, isChineseLocale} from './locale';
import {resources} from './strings';

export type Lang = 'en' | 'zh';
export type LangSetting = 'system' | 'en' | 'zh';

const LANG_KEY = '@mycoins/language';

/** Resolve a stored preference into an actual active language. */
function resolveLang(setting: LangSetting): Lang {
  if (setting === 'system') {
    return isChineseLocale(getSystemLocale()) ? 'zh' : 'en';
  }
  return setting;
}

function lookup(lang: Lang, key: string): string | undefined {
  const parts = key.split('.');
  let node: any = resources[lang];
  for (const part of parts) {
    if (node == null || typeof node !== 'object') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type TParams = Record<string, string | number>;

/** Translate a dot-path key for a specific language (English fallback). */
export function translate(lang: Lang, key: string, params?: TParams): string {
  let str = lookup(lang, key);
  if (str == null) {
    str = lookup('en', key);
  }
  if (str == null) {
    return key;
  }
  if (params) {
    for (const name of Object.keys(params)) {
      str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(params[name]));
    }
  }
  return str;
}

export type TFunc = (key: string, params?: TParams) => string;

interface I18nState {
  setting: LangSetting;
  lang: Lang;
  setLanguage: (setting: LangSetting) => void;
  loadLanguage: () => Promise<void>;
}

export const useI18nStore = create<I18nState>(set => ({
  setting: 'system',
  lang: resolveLang('system'),

  setLanguage: setting => {
    set({setting, lang: resolveLang(setting)});
    AsyncStorage.setItem(LANG_KEY, setting).catch(() => {});
  },

  loadLanguage: async () => {
    try {
      const stored = (await AsyncStorage.getItem(LANG_KEY)) as LangSetting | null;
      if (stored === 'en' || stored === 'zh' || stored === 'system') {
        set({setting: stored, lang: resolveLang(stored)});
      }
    } catch {
      // keep defaults
    }
  },
}));

/** Reactive translator hook — components re-render when the language changes. */
export function useT(): TFunc {
  const lang = useI18nStore(s => s.lang);
  return (key, params) => translate(lang, key, params);
}

/** Non-reactive translator for use outside React components. */
export function getT(): TFunc {
  const lang = useI18nStore.getState().lang;
  return (key, params) => translate(lang, key, params);
}
