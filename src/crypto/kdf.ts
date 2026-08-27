import {argon2idAsync} from './vendor/noble-argon2.js';
import {sha256} from './hash';
import {utf8ToBytes} from './encoding';

/**
 * Key derivation functions available when turning a secret phrase into a prikey.
 *
 * The identifiers mirror fc_ajdk's `Kdf` enum (used by Freer and Safe) so a phrase
 * entered here derives exactly the same prikey it does there.
 */
export type SecretKdf = 'argon2id' | 'sha256';

export const DEFAULT_SECRET_KDF: SecretKdf = 'argon2id';

// fc_ajdk Kdf.ARGON2ID_* — these are stamped into every key ever derived with
// Argon2id_No1_NrC7, so they can never change without minting a new KDF id.
export const ARGON2ID_ITERATIONS = 3;
export const ARGON2ID_MEMORY_KIB = 65536;
export const ARGON2ID_PARALLELISM = 1;
export const DERIVED_KEY_LEN = 32;

/**
 * Argon2id_No1_NrC7: t=3, m=64MiB, p=1, empty salt.
 *
 * The salt is empty on purpose. It makes the derivation deterministic from the
 * phrase alone and keeps it compatible with Safe/Freer, which derive with
 * `Kdf.Argon2id_No1_NrC7` and `new byte[0]`.
 *
 * Argon2id is deliberately slow (a few seconds on a phone). `onProgress` reports
 * completion in the 0..1 range so callers can show a progress indicator; the
 * derivation yields to the event loop between chunks, so the UI stays responsive.
 */
export async function deriveKeyArgon2id(
  phrase: string,
  onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
  return argon2idAsync(utf8ToBytes(phrase), new Uint8Array(0), {
    t: ARGON2ID_ITERATIONS,
    m: ARGON2ID_MEMORY_KIB,
    p: ARGON2ID_PARALLELISM,
    dkLen: DERIVED_KEY_LEN,
    onProgress,
    // Yield about twice a second. The vendored copy yields with a real setTimeout,
    // and RN's timer batching makes each of those cost ~45ms on device, so this is
    // a direct tradeoff: upstream's 10ms default (or even 100ms) spends more time
    // in timer overhead than in hashing. 500ms keeps the progress readout smooth
    // while holding the overhead to a few percent.
    asyncTick: 500,
  });
}

/** Legacy derivation: the raw sha256 of the phrase. Fast, but brute-forceable. */
export function deriveKeySha256(phrase: string): Uint8Array {
  return sha256(utf8ToBytes(phrase));
}
