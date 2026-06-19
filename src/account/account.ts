import {sha256} from '../crypto/hash';
import {utf8ToBytes, bytesToHex} from '../crypto/encoding';

export interface Account {
  id: string; // 12-char hex (first 6 bytes of sha256(sha256(password)))
  symkey: Uint8Array; // 32 bytes: sha256(password)
}

export function deriveSymkey(password: string): Uint8Array {
  return sha256(utf8ToBytes(password));
}

export function deriveAccountId(password: string): string {
  const firstHash = sha256(utf8ToBytes(password));
  const secondHash = sha256(firstHash);
  return bytesToHex(secondHash.slice(0, 6));
}

export function createAccount(password: string): Account {
  return {
    id: deriveAccountId(password),
    symkey: deriveSymkey(password),
  };
}

export function verifyPassword(password: string, accountId: string): boolean {
  return deriveAccountId(password) === accountId;
}
