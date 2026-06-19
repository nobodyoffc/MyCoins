import {NativeModules, Platform} from 'react-native';

/**
 * Reads the device system locale (e.g. "zh-Hans-CN", "en_US") without relying
 * on a third-party native module. Falls back to "en" when unavailable.
 */
export function getSystemLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const fromLocale: string | undefined = settings?.AppleLocale;
      const fromLanguages: string | undefined = Array.isArray(settings?.AppleLanguages)
        ? settings?.AppleLanguages[0]
        : undefined;
      return fromLocale || fromLanguages || 'en';
    }
    // Android
    const identifier: string | undefined = NativeModules.I18nManager?.localeIdentifier;
    return identifier || 'en';
  } catch {
    return 'en';
  }
}

/** True when the given locale string denotes any variety of Chinese. */
export function isChineseLocale(locale: string): boolean {
  return /(^|[-_])zh($|[-_])/i.test(locale) || /hans|hant/i.test(locale);
}
