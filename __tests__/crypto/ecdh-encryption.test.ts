import {
  ecdhSharedSecret,
  hkdfExtract,
  hkdf,
  deriveSymKey,
  encryptAsyTwoWay,
  decryptAsyTwoWay,
} from '../../src/crypto/ecdh-encryption';
import {hexToBytes, bytesToHex, utf8ToBytes} from '../../src/crypto/encoding';
import {getPublicKey} from '../../src/crypto/keys';

// Test keys from API doc
const fidA = {
  fid: 'FEk41Kqjar45fLDriztUDTUkdki7mmcjWK',
  pubkey: '030be1d7e633feb2338a74a860e76d893bac525f35a5813cb7b21e27ba1bc8312a',
  privkey: 'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575',
};

const fidB = {
  fid: 'F86zoAvNaQxEuYyvQssV5WxEzapNaiDtTW',
  pubkey: '02536e4f3a6871831fa91089a5d5a950b96a31c861956f01459c0cd4f4374b2f67',
  privkey: 'ee72e6dd4047ef7f4c9886059cbab42eaab08afe7799cbc0539269ee7e2ec30c',
};

describe('ECDH', () => {
  test('ECDH test vector: prikey=1, pubkey=G', () => {
    const priKey = new Uint8Array(32);
    priKey[31] = 1;
    const pubKey = hexToBytes(
      '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    );
    const z = ecdhSharedSecret(priKey, pubKey);
    expect(bytesToHex(z)).toBe(
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    );
  });

  test('ECDH is symmetric: ECDH(a, B) == ECDH(b, A)', () => {
    const privA = hexToBytes(fidA.privkey);
    const pubA = hexToBytes(fidA.pubkey);
    const privB = hexToBytes(fidB.privkey);
    const pubB = hexToBytes(fidB.pubkey);

    const z1 = ecdhSharedSecret(privA, pubB);
    const z2 = ecdhSharedSecret(privB, pubA);
    expect(bytesToHex(z1)).toBe(bytesToHex(z2));
  });
});

describe('HKDF-SHA512', () => {
  test('TV1: zero IKM, 12-byte zero salt, info="hkdf", L=32', () => {
    const ikm = new Uint8Array(32);
    const salt = new Uint8Array(12);
    const info = utf8ToBytes('hkdf');
    const okm = hkdf(ikm, salt, info, 32);
    expect(bytesToHex(okm)).toBe(
      '79d55d067d55fd67266b49e13949f6ea3fec4e752bbaabe0c52ddc7ac7c02a64',
    );
  });

  test('TV2: extract(null, zero ikm) -> 64-byte PRK', () => {
    const ikm = new Uint8Array(32);
    const prk = hkdfExtract(null, ikm);
    expect(prk.length).toBe(64);
    expect(bytesToHex(prk)).toBe(
      'bae46cebebbb90409abc5acf7ac21fdb339c01ce15192c52fb9e8aa11a8de9a4ea15a045f2be245fbb98916a9ae81b353e33b9c42a55380c5158241daeb3c6dd',
    );
  });

  test('TV3: ikm[i]=i for i=1..32, 12-byte zero salt, info="hkdf", L=32', () => {
    const ikm = hexToBytes(
      '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
    );
    const salt = new Uint8Array(12);
    const info = utf8ToBytes('hkdf');
    const okm = hkdf(ikm, salt, info, 32);
    expect(bytesToHex(okm)).toBe(
      'a90aad642250bb8562417ac75dc4ca02d7b1f0d9533d14ab5a5a122939a69421',
    );
  });
});

describe('Full pipeline', () => {
  test('Pipeline test vector: Z from ECDH(1,G), nonce=101112...1b', () => {
    // Z = ECDH(1, G) x-coord
    const z = hexToBytes(
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    );
    const nonce = hexToBytes('101112131415161718191a1b');
    const info = utf8ToBytes('hkdf');

    // HKDF
    const symkey = hkdf(z, nonce, info, 32);
    expect(bytesToHex(symkey)).toBe(
      '2a2768b8c286dbed4a5c7299d49b9a8aaaedbd7c250862fa8dc6f1b4b56ceb8c',
    );

    // AES-GCM: plaintext = "a" (single byte 0x61)
    // We test via encryptAsyTwoWay roundtrip since we don't expose raw encrypt
    // But let's verify the symkey derivation is correct, which is the critical part
  });
});

describe('AsyTwoWay', () => {
  test('encrypt "Hello world!" with test keys and fixed IV', () => {
    const clientPriv = hexToBytes(fidA.privkey);
    const serverPub = hexToBytes(fidB.pubkey);
    const fixedIV = hexToBytes('000102030405060708090a0b');
    const plaintext = utf8ToBytes('Hello world!');

    const envelope = encryptAsyTwoWay(plaintext, clientPriv, serverPub, fixedIV);

    expect(envelope.type).toBe('AsyTwoWay');
    expect(envelope.alg).toBe('EccK1AesGcm256@No1_NrC7');
    expect(envelope.iv).toBe('000102030405060708090a0b');
    expect(envelope.pubkeyA).toBe(fidA.pubkey);
    expect(envelope.cipher).toBe('15g2ijHqF+CWJfWXOYLlmn+AjHnT7mkVMVcWTg==');
  });

  test('server can decrypt with fidB prikey', () => {
    const envelope = {
      type: 'AsyTwoWay',
      alg: 'EccK1AesGcm256@No1_NrC7',
      cipher: '15g2ijHqF+CWJfWXOYLlmn+AjHnT7mkVMVcWTg==',
      iv: '000102030405060708090a0b',
      pubkeyA: fidA.pubkey,
    };

    const serverPriv = hexToBytes(fidB.privkey);
    const decrypted = decryptAsyTwoWay(envelope, serverPriv);
    const text = new TextDecoder().decode(decrypted);
    expect(text).toBe('Hello world!');
  });

  test('encrypt/decrypt roundtrip with random nonce', () => {
    const clientPriv = hexToBytes(fidA.privkey);
    const serverPub = hexToBytes(fidB.pubkey);
    const serverPriv = hexToBytes(fidB.privkey);

    const plaintext = utf8ToBytes('{"url":"/test","fcdsl":{}}');
    const envelope = encryptAsyTwoWay(plaintext, clientPriv, serverPub);

    const decrypted = decryptAsyTwoWay(envelope, serverPriv);
    expect(new TextDecoder().decode(decrypted)).toBe(
      '{"url":"/test","fcdsl":{}}',
    );
  });
});
