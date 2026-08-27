import {argon2id as vendored} from '../../src/crypto/vendor/noble-argon2.js';
import {argon2id as stock} from '@noble/hashes/argon2.js';
import {
  deriveKeySha256,
  ARGON2ID_ITERATIONS,
  ARGON2ID_MEMORY_KIB,
  ARGON2ID_PARALLELISM,
  DERIVED_KEY_LEN,
} from '../../src/crypto/kdf';
import {bytesToHex, utf8ToBytes} from '../../src/crypto/encoding';
import {sha256} from '../../src/crypto/hash';

// Cheap parameters — these tests are about the patch applied to the vendored
// copy of @noble/hashes' argon2, not about the (slow) production cost settings.
const CHEAP = {t: 1, m: 8, p: 1, dkLen: 32};

describe('kdf', () => {
  test('vendored argon2id matches upstream for a normal salt', () => {
    // Guards the vendoring: the only intended differences are the import paths
    // and the relaxed salt-length check, never the algorithm itself.
    const mine = vendored('phrase', 'salt1234', CHEAP);
    const theirs = stock('phrase', 'salt1234', CHEAP);
    expect(bytesToHex(mine)).toBe(bytesToHex(theirs));
  });

  test('vendored argon2id accepts an empty salt', () => {
    // Upstream rejects salts under 8 bytes; fc's Argon2id_No1_NrC7 uses none.
    const key = vendored('phrase', new Uint8Array(0), CHEAP);
    expect(key.length).toBe(32);
    // An empty salt must not silently behave like some other salt.
    expect(bytesToHex(key)).not.toBe(bytesToHex(vendored('phrase', 'salt1234', CHEAP)));
  });

  test('argon2id parameters match fc_ajdk Kdf.Argon2id_No1_NrC7', () => {
    // Every key ever derived with this KDF depends on these, so they are frozen.
    expect(ARGON2ID_ITERATIONS).toBe(3);
    expect(ARGON2ID_MEMORY_KIB).toBe(65536);
    expect(ARGON2ID_PARALLELISM).toBe(1);
    expect(DERIVED_KEY_LEN).toBe(32);
  });

  test('deriveKeySha256 is the plain hash of the phrase', () => {
    expect(bytesToHex(deriveKeySha256('my secret passphrase'))).toBe(
      bytesToHex(sha256(utf8ToBytes('my secret passphrase'))),
    );
  });
});
