/**
 * Unified API provider using the common endpoint interface.
 *
 * All requests use encrypted POST (AsyTwoWay).
 * Responses are also encrypted (AsyTwoWay) — client must decrypt.
 *
 * Endpoints:
 *   POST /mycoins/v1/getBalance   {"coin":"FCH","address":"Fxxx"}
 *   POST /mycoins/v1/getUtxos     {"coin":"FCH","address":"Fxxx"[,"amount":"1.5"] | [,"size","after"]}
 *   POST /mycoins/v1/broadcast    {"coin":"FCH","rawTx":"0200..."}
 *   POST /mycoins/v1/getTxHistory  {"coin":"FCH","address":"Fxxx"}
 */

import {CoinAPI} from '../types';
import {CoinType, UTXO, Transaction} from '../../coins/types';
import {
  encryptAsyTwoWay,
  decryptAsyTwoWay,
  EncryptedEnvelope,
} from '../../crypto/ecdh-encryption';
import {hexToBytes, utf8ToBytes, bytesToHex} from '../../crypto/encoding';
import {fetchWithTimeout} from '../http';
import {getT} from '../../i18n';

/** Server cash-selection error codes (see APIP CashManager). */
export const FCH_CODE_NO_CASH = 2007; // address has no valid cash at all
export const FCH_CODE_INSUFFICIENT = 1026; // balance is less than amount + fee
export const FCH_CODE_TOO_MANY_INPUTS = 2011; // enough funds, but needs > 200 inputs

/** Error carrying the server's response code, so callers can branch on it. */
export class FchApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/** Page size used when listing cashes without an amount (server max is 5000). */
const CASH_PAGE_SIZE = 1000;
/** Safety cap on the number of pages fetched in one listing. */
const MAX_CASH_PAGES = 20;

function friendlyCashError(code: number, fallback: string): string {
  const t = getT();
  switch (code) {
    case FCH_CODE_INSUFFICIENT:
      return t('send.insufficientFunds');
    case FCH_CODE_TOO_MANY_INPUTS:
      return t('send.tooManyInputs');
    case FCH_CODE_NO_CASH:
      return t('send.noCash');
    default:
      return fallback;
  }
}

function mapCash(cash: any): UTXO {
  return {
    txid: cash.birthTxId,
    vout: cash.birthIndex ?? 0,
    value: cash.value,
    scriptPubKey: cash.lockScript || '',
  };
}

/** The server returns the paging cursor as a list; send it back as JSON text. */
function cursorParam(last: any): string | null {
  if (last == null) return null;
  return typeof last === 'string' ? last : JSON.stringify(last);
}

export interface FCHServiceInfo {
  dealer: string;
  dealerPubkey: string;
  minPayment: string; // in FCH (e.g. "0.0001") — amount to (re)buy the service
  minCredit: string;  // in FCH — the credit limit; account is cut off at balance < -minCredit
  pricePerKB: string;
  currency: string;
}

export type ApiCreditKind = 'low' | 'exhausted';

/**
 * Emitted when the user's API credit needs attention.
 *  - 'low': the credit balance has dropped to half the credit limit; suggest a
 *    top-up before the service is interrupted.
 *  - 'exhausted': the balance passed the credit limit (server returned 1004);
 *    charged requests are blocked until the user tops up.
 * Balances are in satoshis and go negative as free credit is consumed.
 */
export interface ApiCreditEvent {
  kind: ApiCreditKind;
  dealer: string;
  minPayment: string; // FCH coin string
  minCredit: string;  // FCH coin string
  balanceSats: number | null; // current credit balance; negative = owed
}

// Global callback — set by the UI layer (ApiPaymentHandler)
let onApiCreditEvent: ((event: ApiCreditEvent) => void) | null = null;

export function setOnApiCreditEvent(callback: ((event: ApiCreditEvent) => void) | null) {
  onApiCreditEvent = callback;
}

/** Convert an FCH coin-amount string (e.g. "0.001") to satoshis. */
export function fchToSatoshis(amount: string): number {
  const parts = (amount || '0').split('.');
  const intPart = parts[0] || '0';
  const fracPart = (parts[1] || '').padEnd(8, '0').slice(0, 8);
  return parseInt(intPart + fracPart, 10) || 0;
}

export class CommonAPI implements CoinAPI {
  private baseUrl: string;
  private coin: CoinType;
  private clientPrivateKey: Uint8Array | null = null;
  private serverPubkey: Uint8Array | null = null;
  private serviceInfo: FCHServiceInfo | null = null;
  private lastBalanceSats: number | null = null;
  private lowCreditNotified = false;
  // In-flight getService fetch, shared so concurrent callers don't each fire one.
  private servicePromise: Promise<void> | null = null;

  constructor(baseUrl: string, coin: CoinType) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.coin = coin;
  }

  setKeys(clientPrivateKeyHex: string, serverPubkeyHex: string) {
    this.clientPrivateKey = hexToBytes(clientPrivateKeyHex);
    this.serverPubkey = hexToBytes(serverPubkeyHex);
  }

  getServiceInfo(): FCHServiceInfo | null {
    return this.serviceInfo;
  }

  getClientPrivateKey(): Uint8Array | null {
    return this.clientPrivateKey;
  }

  /**
   * Send an encrypted POST request to a common API endpoint.
   */
  private async encryptedPost(endpoint: string, params: Record<string, string>): Promise<any> {
    return (await this.encryptedPostRaw(endpoint, params)).data;
  }

  /** Like encryptedPost, but returns the whole decrypted response (data, got, total, last...). */
  private async encryptedPostRaw(endpoint: string, params: Record<string, string>): Promise<any> {
    await this.ensureReady();
    if (!this.clientPrivateKey || !this.serverPubkey) {
      throw new Error(`[CommonAPI] FCH API not ready (server may be offline)`);
    }

    console.log(`[CommonAPI] POST ${endpoint}`, JSON.stringify(params));

    const plaintext = utf8ToBytes(JSON.stringify(params));
    const envelope = encryptAsyTwoWay(plaintext, this.clientPrivateKey, this.serverPubkey);

    const url = `${this.baseUrl}/mycoins/v1/${endpoint}`;
    console.log(`[CommonAPI] Fetching ${url}`);
    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(envelope),
    });

    const respText = await resp.text();
    console.log(`[CommonAPI] Response status=${resp.status}, length=${respText.length}`);

    // Try to decrypt the response
    let respData: any;
    try {
      const respEnvelope: EncryptedEnvelope = JSON.parse(respText);
      if (respEnvelope.type === 'AsyTwoWay' && respEnvelope.cipher) {
        const decryptedBytes = decryptAsyTwoWay(respEnvelope, this.clientPrivateKey);
        const decryptedStr = String.fromCharCode(...decryptedBytes);
        console.log(`[CommonAPI] Decrypted: ${decryptedStr.substring(0, 200)}`);
        respData = JSON.parse(decryptedStr);
      } else {
        respData = respEnvelope;
      }
    } catch (decryptErr: any) {
      console.warn(`[CommonAPI] Decrypt failed: ${decryptErr.message}, trying plain JSON`);
      try {
        respData = JSON.parse(respText);
      } catch {
        throw new Error(`[CommonAPI] Invalid response from ${endpoint}: ${respText.substring(0, 100)}`);
      }
    }

    // Handle error code 1004: credit exhausted — charged requests are blocked.
    if (respData.code === 1004) {
      this.lowCreditNotified = true; // suppress a redundant 'low' popup
      this.emitCreditEvent('exhausted', null);
      throw new Error('API balance exhausted. Please top up to continue using the service.');
    }

    if (respData.code !== 0) {
      throw new FchApiError(
        respData.code,
        friendlyCashError(
          respData.code,
          `[CommonAPI] ${endpoint} error [${respData.code}]: ${respData.message}`,
        ),
      );
    }

    // Every charged response reports the user's credit balance (satoshis,
    // negative as free credit is consumed). Track it and warn at half-credit.
    const balanceSats =
      typeof respData.balance === 'number' ? respData.balance : null;
    if (balanceSats !== null) this.lastBalanceSats = balanceSats;
    this.checkCredit(balanceSats);

    console.log(`[CommonAPI] ${endpoint} success`);
    return respData;
  }

  /**
   * Warn when the credit balance drops to half the credit limit.
   * minCredit is the (positive) credit limit in FCH; the server cuts the
   * account off at balance < -minCredit, so half-credit is balance <= -(minCredit/2).
   */
  private checkCredit(balanceSats: number | null) {
    if (balanceSats === null || !this.serviceInfo) return;
    const minCreditSats = fchToSatoshis(this.serviceInfo.minCredit);
    if (minCreditSats <= 0) return;
    const halfCreditFloor = -(minCreditSats / 2);
    if (balanceSats <= halfCreditFloor) {
      if (!this.lowCreditNotified) {
        this.lowCreditNotified = true;
        this.emitCreditEvent('low', balanceSats);
      }
    } else {
      this.lowCreditNotified = false; // balance recovered above the threshold
    }
  }

  /**
   * Emit a credit event to the UI. If service info isn't cached yet, fetch it
   * (getService is free) and retry once.
   */
  private emitCreditEvent(kind: ApiCreditKind, balanceSats: number | null) {
    const svc = this.serviceInfo;
    if (!svc) {
      console.warn('[CommonAPI] credit event but no service info cached, fetching...');
      fetch(`${this.baseUrl}/mycoins/v1/getService`)
        .then(r => r.json())
        .then(json => {
          const s = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
          if (s?.dealer) {
            this.serviceInfo = {
              dealer: s.dealer,
              dealerPubkey: s.dealerPubkey || '',
              minPayment: s.minPayment || '0.0001',
              minCredit: s.minCredit || '0',
              pricePerKB: s.pricePerKB || '0.00000001',
              currency: s.currency || 'fch',
            };
            this.emitCreditEvent(kind, balanceSats); // retry with service info
          }
        })
        .catch(() => {});
      return;
    }

    const event: ApiCreditEvent = {
      kind,
      dealer: svc.dealer,
      minPayment: svc.minPayment,
      minCredit: svc.minCredit,
      balanceSats,
    };
    console.log(`[CommonAPI] credit event: kind=${kind}, balance=${balanceSats}, minCredit=${svc.minCredit}`);
    if (onApiCreditEvent) onApiCreditEvent(event);
  }

  getLastBalanceSats(): number | null {
    return this.lastBalanceSats;
  }

  /**
   * Fetch the user's spendable cashes via the FREE GET cashValid endpoint.
   * Works even when charged POST endpoints are blocked (credit exhausted),
   * so the user can always fund a top-up.
   */
  async fetchValidCashesFree(address: string, amount?: string): Promise<UTXO[]> {
    const base = `${this.baseUrl}/mycoins/v1/cashValid?fid=${encodeURIComponent(address)}`;
    if (amount) {
      // Server picks enough cashes (incl. fee) to cover the amount.
      const resp = await fetch(`${base}&amount=${encodeURIComponent(amount)}`);
      const json = await resp.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data.map(mapCash);
    }
    // No amount: walk every page so large cashes beyond the first page aren't missed.
    const all: UTXO[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_CASH_PAGES; page++) {
      let url = `${base}&size=${CASH_PAGE_SIZE}`;
      if (after) url += `&after=${encodeURIComponent(after)}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (json.code !== 0 || !Array.isArray(json.data)) break;
      all.push(...json.data.map(mapCash));
      after = cursorParam(json.last);
      if (!after || json.data.length === 0) break;
      if (typeof json.total === 'number' && all.length >= json.total) break;
    }
    return all;
  }

  /**
   * Broadcast a signed raw TX via the FREE GET broadcastTx endpoint.
   * Works even when credit is exhausted. Returns the txid.
   */
  async broadcastRawFree(rawHex: string): Promise<string> {
    const url = `${this.baseUrl}/mycoins/v1/broadcastTx?rawTx=${rawHex}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.code !== 0) {
      throw new Error(json.message || `broadcast failed [${json.code}]`);
    }
    return json.data;
  }

  /**
   * Initialize by fetching the server's pubkey from getService.
   */
  async init(clientPrivateKeyHex: string): Promise<void> {
    this.clientPrivateKey = hexToBytes(clientPrivateKeyHex);
    await this.loadService();
  }

  /**
   * The server pubkey is fetched once at login. If that request failed (slow
   * network right after the phone wakes, server briefly down), retry it lazily
   * here instead of leaving FCH broken until the app is restarted.
   */
  private async ensureReady(): Promise<void> {
    if (this.serverPubkey || !this.clientPrivateKey) return;
    console.log('[CommonAPI] server pubkey missing, retrying getService');
    await this.loadService();
  }

  private loadService(): Promise<void> {
    if (!this.servicePromise) {
      this.servicePromise = this.fetchService().finally(() => {
        this.servicePromise = null;
      });
    }
    return this.servicePromise;
  }

  private async fetchService(): Promise<void> {
    const url = `${this.baseUrl}/mycoins/v1/getService`;
    console.log(`[CommonAPI] init: fetching ${url}`);
    const resp = await fetchWithTimeout(url, {}, 10000);
    const json = await resp.json();
    const service = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
    if (service?.dealerPubkey) {
      this.serverPubkey = hexToBytes(service.dealerPubkey);
      this.serviceInfo = {
        dealer: service.dealer || '',
        dealerPubkey: service.dealerPubkey,
        minPayment: service.minPayment || '0.0001',
        minCredit: service.minCredit || '0',
        pricePerKB: service.pricePerKB || '0.00000001',
        currency: service.currency || 'fch',
      };
      console.log(`[CommonAPI] init: dealer=${this.serviceInfo.dealer}, minPayment=${this.serviceInfo.minPayment}, minCredit=${this.serviceInfo.minCredit}`);
    } else {
      console.error(`[CommonAPI] init: no dealerPubkey in response`);
      throw new Error('Failed to get server pubkey from getService');
    }
  }

  // ---- CoinAPI interface ----

  async getBalance(address: string): Promise<string> {
    const data = await this.encryptedPost('getBalance', {
      coin: this.coin,
      address,
    });
    return String(data.balance ?? 0);
  }

  /**
   * Fetch spendable UTXOs.
   *  - With `amount` (FCH string), the server selects enough cashes to cover
   *    amount + fee (at most 200 inputs) and returns 1026 / 2011 when it can't.
   *  - Without it, every page is fetched so no cash is left out.
   */
  async getUTXOs(
    address: string,
    opts?: {amount?: string; outputSize?: number},
  ): Promise<UTXO[]> {
    const mapUtxo = (u: any): UTXO => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      scriptPubKey: u.script || '',
    });

    if (opts?.amount) {
      const params: Record<string, string> = {
        coin: this.coin,
        address,
        amount: opts.amount,
      };
      if (opts.outputSize) params.outputSize = String(opts.outputSize);
      try {
        const resp = await this.encryptedPostRaw('getUtxos', params);
        return Array.isArray(resp.data) ? resp.data.map(mapUtxo) : [];
      } catch (err: any) {
        if (err instanceof FchApiError && err.code === FCH_CODE_NO_CASH) return [];
        throw err;
      }
    }

    const all: UTXO[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_CASH_PAGES; page++) {
      const params: Record<string, string> = {
        coin: this.coin,
        address,
        size: String(CASH_PAGE_SIZE),
      };
      if (after) params.after = after;
      let resp: any;
      try {
        resp = await this.encryptedPostRaw('getUtxos', params);
      } catch (err: any) {
        if (err instanceof FchApiError && err.code === FCH_CODE_NO_CASH) break;
        throw err;
      }
      if (!Array.isArray(resp.data) || resp.data.length === 0) break;
      all.push(...resp.data.map(mapUtxo));
      after = cursorParam(resp.last);
      if (!after) break;
      if (typeof resp.total === 'number' && all.length >= resp.total) break;
    }
    return all;
  }

  async broadcastTransaction(rawHex: string): Promise<string> {
    const data = await this.encryptedPost('broadcast', {
      coin: this.coin,
      rawTx: rawHex,
    });
    return data.txid || data;
  }

  async getTransactionHistory(address: string): Promise<Transaction[]> {
    const data = await this.encryptedPost('getTxHistory', {
      coin: this.coin,
      address,
    });
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((tx: any) => ({
      txid: tx.txid,
      coin: this.coin,
      from: '',
      to: address,
      amount: String(tx.value || 0),
      fee: '0',
      timestamp: tx.time || 0,
      confirmations: tx.confirmations || 0,
      direction: (tx.direction || 'in') as 'in' | 'out',
    }));
  }
}
