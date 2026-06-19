// Each namespace module exports { en, zh } with matching key shapes.
// Add new screens here and they become available as `t('<namespace>.<key>')`.
import common from './common';
import nav from './nav';
import settings from './settings';
import login from './login';
import createAccount from './createAccount';
import keyList from './keyList';
import addKey from './addKey';
import dashboard from './dashboard';
import coinDetail from './coinDetail';
import send from './send';
import receive from './receive';
import txDetail from './txDetail';
import swapList from './swapList';
import swapDetail from './swapDetail';
import components from './components';
import scanner from './scanner';

const namespaces = {
  common,
  nav,
  settings,
  login,
  createAccount,
  keyList,
  addKey,
  dashboard,
  coinDetail,
  send,
  receive,
  txDetail,
  swapList,
  swapDetail,
  components,
  scanner,
};

function build(lang: 'en' | 'zh'): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, mod] of Object.entries(namespaces)) {
    out[name] = (mod as any)[lang];
  }
  return out;
}

export const resources = {
  en: build('en'),
  zh: build('zh'),
};
