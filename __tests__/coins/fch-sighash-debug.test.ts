/**
 * Debug: dump the exact BIP143 sighash preimage our builder generates
 * for a 1-input, 2-output FCH transaction.
 */

import {
  TxWriter,
  p2pkhScript,
} from '../../src/coins/utxo-common';
import {doubleSha256, hash160} from '../../src/crypto/hash';
import {hexToBytes, bytesToHex} from '../../src/crypto/encoding';
import {privateKeyFromHex, getPublicKey} from '../../src/crypto/keys';

const TEST_PRIVKEY = 'a048f6c843f92bfe036057f7fc2bf2c27353c624cf7ad97e98ed41432f700575';

describe('FCH sighash debug', () => {
  test('dump BIP143 preimage for test TX', () => {
    const privKey = privateKeyFromHex(TEST_PRIVKEY);
    const pubKey = getPublicKey(privKey, true);
    console.log('pubKey:', bytesToHex(pubKey));

    const pubKeyHash = hash160(pubKey);
    console.log('pubKeyHash:', bytesToHex(pubKeyHash));

    const scriptPubKey = p2pkhScript(pubKeyHash);
    console.log('scriptPubKey:', bytesToHex(scriptPubKey));

    // Our UTXO (from cashValid API):
    // txid=5c421f3776ba62568941f34eee69304c7630f00d1a2821cdce78f74d2d5fb0f9
    // birthIndex=1 (this is vout=1)
    // value=250972082
    // lockScript=76a91461c42abb6e3435e63bd88862f3746a3f8b86354288ac

    const txid = '5c421f3776ba62568941f34eee69304c7630f00d1a2821cdce78f74d2d5fb0f9';
    const vout = 1;
    const value = 250972082;
    const lockScript = '76a91461c42abb6e3435e63bd88862f3746a3f8b86354288ac';

    const sighashType = 0x41;
    const forkId = 0;
    const txVersion = 2;
    const lockTime = 0;

    // Step 1: hashPrevouts
    const prevoutsWriter = new TxWriter();
    prevoutsWriter.writeReversedHash(txid);
    prevoutsWriter.writeUint32LE(vout);
    const prevoutsData = prevoutsWriter.toBytes();
    console.log('prevouts data:', bytesToHex(prevoutsData));
    const hashPrevouts = doubleSha256(prevoutsData);
    console.log('hashPrevouts:', bytesToHex(hashPrevouts));

    // Step 2: hashSequence
    const seqWriter = new TxWriter();
    seqWriter.writeUint32LE(0xffffffff);
    const seqData = seqWriter.toBytes();
    console.log('sequence data:', bytesToHex(seqData));
    const hashSequence = doubleSha256(seqData);
    console.log('hashSequence:', bytesToHex(hashSequence));

    // Step 3: hashOutputs
    // Output 0: 10000 sat to FEk41Kqjar45fLDriztUDTUkdki7mmcjWK
    // Output 1: change to same address
    const change = value - 10000 - 226; // fee = 226

    const outsWriter = new TxWriter();
    outsWriter.writeUint64LE(10000);
    outsWriter.writeVarBytes(hexToBytes(lockScript));
    outsWriter.writeUint64LE(change);
    outsWriter.writeVarBytes(hexToBytes(lockScript));
    const outsData = outsWriter.toBytes();
    console.log('outputs data:', bytesToHex(outsData));
    const hashOutputs = doubleSha256(outsData);
    console.log('hashOutputs:', bytesToHex(hashOutputs));

    // Step 4: Full preimage
    const preimage = new TxWriter();
    preimage.writeUint32LE(txVersion); // nVersion
    preimage.writeBytes(hashPrevouts);  // hashPrevouts
    preimage.writeBytes(hashSequence);  // hashSequence
    // outpoint
    preimage.writeReversedHash(txid);
    preimage.writeUint32LE(vout);
    // scriptCode
    preimage.writeVarBytes(hexToBytes(lockScript));
    // value
    preimage.writeUint64LE(value);
    // nSequence
    preimage.writeUint32LE(0xffffffff);
    preimage.writeBytes(hashOutputs);   // hashOutputs
    preimage.writeUint32LE(lockTime);   // nLockTime
    preimage.writeUint32LE(sighashType | (forkId << 8)); // nHashType

    const preimageBytes = preimage.toBytes();
    console.log('preimage length:', preimageBytes.length);
    console.log('preimage hex:', bytesToHex(preimageBytes));

    const sighash = doubleSha256(preimageBytes);
    console.log('sighash:', bytesToHex(sighash));
  });
});
