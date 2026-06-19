import {CoinAPI, APIConfig} from '../types';
import {CoinType, UTXO, Transaction, FeeEstimate} from '../../coins/types';
import {fetchWithTimeout} from '../http';

/**
 * Blockbook API provider (Trezor) — used for BCH.
 * Public servers are free and need no API key.
 * Default BCH server: https://bch1.trezor.io
 * Docs: https://github.com/trezor/blockbook/blob/master/docs/api.md
 *
 * Blockbook runs one instance per coin, so the chain is encoded in the
 * host (baseUrl) rather than the path.
 */
export class BlockbookAPI implements CoinAPI {
  private config: APIConfig;
  private coin: CoinType;

  constructor(coin: CoinType, config?: Partial<APIConfig>) {
    this.coin = coin;
    this.config = {
      baseUrl: config?.baseUrl || 'https://bch1.trezor.io',
      apiKey: config?.apiKey,
      timeout: config?.timeout || 15000,
    };
  }

  private get baseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  private async fetchJson(path: string): Promise<any> {
    const resp = await fetchWithTimeout(
      `${this.baseUrl}/api/v2${path}`,
      {},
      this.config.timeout,
    );
    if (!resp.ok) {
      throw new Error(`Blockbook API error: ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
  }

  // CashAddr is returned with a `bitcoincash:` prefix; normalise so the
  // queried address and tx in/out addresses can be compared reliably.
  private static normalizeAddr(addr: string): string {
    return addr.toLowerCase().replace(/^.*:/, '');
  }

  async getBalance(address: string): Promise<string> {
    const json = await this.fetchJson(
      `/address/${address}?details=basic`,
    );
    // `balance` is the confirmed balance in satoshis (string).
    return String(json.balance ?? 0);
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    const json = await this.fetchJson(`/utxo/${address}`);
    if (!Array.isArray(json)) {
      return [];
    }
    // Blockbook returns both confirmed and unconfirmed UTXOs, so change
    // outputs are spendable right away. scriptPubKey isn't provided and is
    // reconstructed from the address by the tx builder.
    return json.map((u: any) => ({
      txid: u.txid,
      vout: u.vout,
      value: Number(u.value),
      scriptPubKey: '',
    }));
  }

  async broadcastTransaction(rawHex: string): Promise<string> {
    const resp = await fetchWithTimeout(
      `${this.baseUrl}/api/v2/sendtx/`,
      {
        method: 'POST',
        headers: {'Content-Type': 'text/plain'},
        body: rawHex,
      },
      this.config.timeout,
    );
    const json = await resp.json();
    if (json.result) {
      return json.result;
    }
    throw new Error(
      `Broadcast failed: ${json.error?.message || json.error || JSON.stringify(json)}`,
    );
  }

  async getTransactionHistory(
    address: string,
    page: number = 0,
  ): Promise<Transaction[]> {
    // Blockbook pages are 1-based.
    const json = await this.fetchJson(
      `/address/${address}?details=txs&pageSize=20&page=${page + 1}`,
    );
    if (!Array.isArray(json.transactions)) {
      return [];
    }
    const target = BlockbookAPI.normalizeAddr(address);
    const matches = (addrs?: string[]) =>
      Array.isArray(addrs) &&
      addrs.some(a => BlockbookAPI.normalizeAddr(a) === target);

    return json.transactions.map((tx: any) => {
      const sumIn = (tx.vin || []).reduce(
        (acc: number, vin: any) =>
          matches(vin.addresses) ? acc + Number(vin.value || 0) : acc,
        0,
      );
      const sumOut = (tx.vout || []).reduce(
        (acc: number, vout: any) =>
          matches(vout.addresses) ? acc + Number(vout.value || 0) : acc,
        0,
      );
      const net = sumOut - sumIn;
      return {
        txid: tx.txid,
        coin: this.coin,
        from: '',
        to: '',
        amount: String(Math.abs(net)),
        fee: String(tx.fees ?? 0),
        timestamp: tx.blockTime ?? 0,
        confirmations: tx.confirmations ?? 0,
        direction: net >= 0 ? ('in' as const) : ('out' as const),
      };
    });
  }

  async estimateFee(): Promise<FeeEstimate> {
    const json = await this.fetchJson('/estimatefee/2');
    // `result` is BCH per kB; convert to satoshis per byte.
    const bchPerKb = parseFloat(json.result || '0');
    const satPerByte = Math.round((bchPerKb * 1e8) / 1000);
    const medium = Math.max(1, satPerByte);
    return {
      low: Math.max(1, Math.floor(medium * 0.5)),
      medium,
      high: Math.ceil(medium * 2),
    };
  }
}
