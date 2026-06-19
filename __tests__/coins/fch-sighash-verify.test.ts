/**
 * Verify that our BIP143 sighash computation matches the known good FCH TX.
 */

import {TxWriter, p2pkhScript} from '../../src/coins/utxo-common';
import {doubleSha256, hash160} from '../../src/crypto/hash';
import {hexToBytes, bytesToHex} from '../../src/crypto/encoding';
import {privateKeyFromHex, getPublicKey} from '../../src/crypto/keys';
import {verifySchnorrBCH, signSchnorrBCH} from '../../src/crypto/schnorr-bch';

const TEST_PRIVKEY = 'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575';
const TEST_PUBKEY = '030be1d7e633feb2338a74a860e76d893bac525f35a5813cb7b21e27ba1bc8312a';

// Known good TX inputs
const INPUT_0 = {
  txid: '7aee7779eeebaf554281a587cde41b10a1136ab4fd0bac44aacecef42ec6698d',
  vout: 0,
  value: 5998216,
};
const INPUT_1 = {
  txid: '3e6469e54085985c3e50ce227ee96252c066a9bdf5586dc672a076a82ccbdc25',
  vout: 1,
  value: 344974226,
};

// Known signature from the valid TX (input 0)
const KNOWN_SIG = 'a0a25a26010c0aff3079bf0ffb1b1a39b5ebca09b4a86dd1bd221d5f8e9d2a2aa94a910f94461021a08f007a6185fa5d50392dcacf2e9755007ffaac70ca2c90';

// Output script for FEk41Kqjar45fLDriztUDTUkdki7mmcjWK
const LOCK_SCRIPT = '76a91461c42abb6e3435e63bd88862f3746a3f8b86354288ac';

describe('FCH sighash verification', () => {
  test('compute BIP143 sighash for input 0 of known good TX', () => {
    const pubKey = hexToBytes(TEST_PUBKEY);
    const sighashType = 0x41; // SIGHASH_ALL | SIGHASH_FORKID
    const forkId = 0;
    const txVersion = 2;
    const lockTime = 0;

    // hashPrevouts = sha256d(all prevouts)
    const prevoutsWriter = new TxWriter();
    prevoutsWriter.writeReversedHash(INPUT_0.txid);
    prevoutsWriter.writeUint32LE(INPUT_0.vout);
    prevoutsWriter.writeReversedHash(INPUT_1.txid);
    prevoutsWriter.writeUint32LE(INPUT_1.vout);
    const hashPrevouts = doubleSha256(prevoutsWriter.toBytes());

    // hashSequence = sha256d(all sequences)
    const seqWriter = new TxWriter();
    seqWriter.writeUint32LE(0xffffffff);
    seqWriter.writeUint32LE(0xffffffff);
    const hashSequence = doubleSha256(seqWriter.toBytes());

    // hashOutputs = sha256d(all outputs)
    const outsWriter = new TxWriter();
    outsWriter.writeUint64LE(100000000); // output 0
    const outScript = hexToBytes(LOCK_SCRIPT);
    outsWriter.writeVarBytes(outScript);
    outsWriter.writeUint64LE(250972082); // output 1
    outsWriter.writeVarBytes(outScript);
    const hashOutputs = doubleSha256(outsWriter.toBytes());

    // BIP143 preimage for input 0
    const preimage = new TxWriter();
    preimage.writeUint32LE(txVersion);
    preimage.writeBytes(hashPrevouts);
    preimage.writeBytes(hashSequence);
    preimage.writeReversedHash(INPUT_0.txid);
    preimage.writeUint32LE(INPUT_0.vout);
    preimage.writeVarBytes(hexToBytes(LOCK_SCRIPT));
    preimage.writeUint64LE(INPUT_0.value);
    preimage.writeUint32LE(0xffffffff);
    preimage.writeBytes(hashOutputs);
    preimage.writeUint32LE(lockTime);
    preimage.writeUint32LE(sighashType | (forkId << 8));

    const sighash = doubleSha256(preimage.toBytes());
    console.log('sighash:', bytesToHex(sighash));

    // Verify the known signature against our sighash
    const sig = hexToBytes(KNOWN_SIG);
    const valid = verifySchnorrBCH(sig, sighash, pubKey);
    console.log('Known signature valid:', valid);

    // Also try signing with our key and verifying
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const ourSig = signSchnorrBCH(sighash, privKey);
    console.log('Our sig:', bytesToHex(ourSig));
    const ourValid = verifySchnorrBCH(ourSig, sighash, pubKey);
    console.log('Our signature valid:', ourValid);
  });
});
