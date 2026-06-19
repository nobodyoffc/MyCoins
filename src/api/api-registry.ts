import {CoinType} from '../coins/types';
import {isCoinHidden} from '../coins/registry';
import {CoinAPI, APIConfig} from './types';
import {CommonAPI} from './providers/common-api';
import {FreecashAPI} from './providers/freecash';
import {BlockCypherAPI} from './providers/blockcypher';
import {BlockchairAPI} from './providers/blockchair';
import {BlockbookAPI} from './providers/blockbook';
import {EthereumAPI} from './providers/ethereum';

interface ProviderRegistry {
  providers: Map<CoinType, CoinAPI>;
  fchCommonApi: CommonAPI | null;
  fchLegacyApi: FreecashAPI | null;
}

const registry: ProviderRegistry = {
  providers: new Map(),
  fchCommonApi: null,
  fchLegacyApi: null,
};

// Build a UTXO-coin provider from the saved preset type. Preset keys map to
// concrete provider classes; 'custom' (or unknown/undefined) falls back to the
// coin's built-in default class. The matching baseUrl is supplied by the caller.
function buildUtxoProvider(
  coin: CoinType,
  providerType: string | undefined,
  baseUrl: string | undefined,
  apiKey: string | undefined,
  fallback: 'blockcypher' | 'blockbook',
): CoinAPI {
  const type =
    providerType === 'blockchair' ||
    providerType === 'blockbook' ||
    providerType === 'blockcypher'
      ? providerType
      : fallback;
  switch (type) {
    case 'blockchair':
      return new BlockchairAPI(coin, {baseUrl, apiKey});
    case 'blockbook':
      return new BlockbookAPI(coin, {baseUrl, apiKey});
    default:
      return new BlockCypherAPI(coin, {baseUrl, apiKey});
  }
}

export function initializeProviders(config?: {
  fchBaseUrl?: string;
  fchClientPrivkeyHex?: string;
  btcProviderType?: string;
  btcBaseUrl?: string;
  btcApiKey?: string;
  dogeProviderType?: string;
  dogeBaseUrl?: string;
  dogeApiKey?: string;
  bchProviderType?: string;
  bchBaseUrl?: string;
  bchApiKey?: string;
  ethRpcUrl?: string;
  etherscanApiKey?: string;
}): void {
  const fchBaseUrl = config?.fchBaseUrl || 'https://freecash.info/APIP';

  // FCH via common API (encrypted request + response)
  const fchCommonApi = new CommonAPI(fchBaseUrl, CoinType.FCH);
  registry.fchCommonApi = fchCommonApi;

  // Also keep legacy API for getService and FCH-specific endpoints
  const fchLegacyApi = new FreecashAPI({baseUrl: fchBaseUrl});
  registry.fchLegacyApi = fchLegacyApi;

  // Initialize: fetch server pubkey, then set up common API keys
  fchLegacyApi.init().then(info => {
    if (info.dealerPubkey && config?.fchClientPrivkeyHex) {
      fchCommonApi.setKeys(config.fchClientPrivkeyHex, info.dealerPubkey);
    }
  }).catch(() => {
    // Silently fail — keys can be set later
  });

  // Use common API for FCH (falls back to legacy GET if keys not set)
  registry.providers.set(CoinType.FCH, fchCommonApi);

  // BTC, DOGE, BCH — honor the user's saved provider choice; otherwise use the
  // coin's default class (BlockCypher for BTC/DOGE, Blockbook for BCH).
  registry.providers.set(
    CoinType.BTC,
    buildUtxoProvider(CoinType.BTC, config?.btcProviderType, config?.btcBaseUrl, config?.btcApiKey, 'blockcypher'),
  );
  registry.providers.set(
    CoinType.DOGE,
    buildUtxoProvider(CoinType.DOGE, config?.dogeProviderType, config?.dogeBaseUrl, config?.dogeApiKey, 'blockcypher'),
  );
  registry.providers.set(
    CoinType.BCH,
    buildUtxoProvider(CoinType.BCH, config?.bchProviderType, config?.bchBaseUrl, config?.bchApiKey, 'blockbook'),
  );

  // ETH, USDT, USDC via Ethereum RPC + Etherscan
  const ethConfig: Partial<APIConfig> = {
    baseUrl: config?.ethRpcUrl,
    apiKey: config?.etherscanApiKey,
  };
  registry.providers.set(CoinType.ETH, new EthereumAPI(CoinType.ETH, ethConfig));
  registry.providers.set(CoinType.USDT, new EthereumAPI(CoinType.USDT, ethConfig));
  registry.providers.set(CoinType.USDC, new EthereumAPI(CoinType.USDC, ethConfig));
}

export function getProvider(coin: CoinType): CoinAPI {
  const provider = registry.providers.get(coin);
  if (!provider) {
    throw new Error(`No API provider configured for ${coin}`);
  }
  return provider;
}

export function getFCHCommonApi(): CommonAPI {
  if (!registry.fchCommonApi) {
    throw new Error('FCH Common API not initialized.');
  }
  return registry.fchCommonApi;
}

export function getFCHLegacyApi(): FreecashAPI {
  if (!registry.fchLegacyApi) {
    throw new Error('FCH Legacy API not initialized.');
  }
  return registry.fchLegacyApi;
}

export function setProvider(coin: CoinType, provider: CoinAPI): void {
  registry.providers.set(coin, provider);
}

// Returns the raw balance per coin, or `null` when fetching that coin's
// balance from the API failed. `null` is distinct from '0': callers must
// surface a failed fetch (e.g. show '!') rather than a misleading zero.
export async function fetchAllBalances(
  addresses: Record<CoinType, string>,
): Promise<Record<CoinType, string | null>> {
  const results: Partial<Record<CoinType, string | null>> = {};
  const errors: string[] = [];

  const coins = Object.values(CoinType);
  const promises = coins.map(async coin => {
    try {
      if (isCoinHidden(coin)) {
        results[coin] = '0';
        return;
      }
      const provider = registry.providers.get(coin);
      if (provider && addresses[coin]) {
        results[coin] = await provider.getBalance(addresses[coin]);
      } else {
        results[coin] = '0';
      }
    } catch (err: any) {
      // Signal failure with null so the UI can show '!' instead of a wrong 0.
      results[coin] = null;
      errors.push(`${coin}: ${err.message}`);
    }
  });

  await Promise.all(promises);

  if (errors.length > 0) {
    // Log errors so they can be seen in Metro console
    console.warn('[fetchAllBalances] Errors:', errors.join('; '));
  }

  return results as Record<CoinType, string | null>;
}
