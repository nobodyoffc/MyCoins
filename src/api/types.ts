import {CoinType, UTXO, Transaction, FeeEstimate, GasEstimate} from '../coins/types';

export interface CoinAPI {
  getBalance(address: string): Promise<string>;
  /** opts.amount (coin units) lets servers that support it pick just enough UTXOs. */
  getUTXOs?(address: string, opts?: {amount?: string; outputSize?: number}): Promise<UTXO[]>;
  getNonce?(address: string): Promise<number>;
  getGasPrice?(): Promise<GasEstimate>;
  broadcastTransaction(rawHex: string): Promise<string>;
  getTransactionHistory(address: string, page?: number): Promise<Transaction[]>;
  estimateFee?(): Promise<FeeEstimate>;
}

export interface APIConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface FCHServiceInfo {
  dealer: string;
  dealerPubkey: string;
}
