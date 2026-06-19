# How We Built MyCoins Wallet with AI

A record of building a multi-coin crypto wallet from an empty directory to a working app with live transaction broadcasting — in one continuous conversation between a human and Claude Code.

**Tool:** Claude Code v2.1.101 (Opus 4.6, 1M context)
**Date:** 2026-04-12

---

## 1. The Opening Request

> **Human:** I want to create a wallet to receive and send BTC, ETH, BCH, FCH, DOGE, USDT(on eth), USDC(on eth). User can create multiple password. Each password contains a group of prikeys(pubkeys). User choose a prikey by its FCH address to login and then manage all the coins from the same prikey. We may connect one or more API server for fetch the informations of these coins and broadcast TXs. Before coding, let's talk.

**Claude:** Empty project — starting from scratch. Great, let's talk through the design. I have several questions to align on before planning.

## 2. Design Discussion — Round 1: Platform & Basics

**Claude asked:** What platform? What language? How to store private keys? What is FCH?

> **Human:**
> - Mobile (React Native)
> - Please give me suggestion
> - Encrypted JSON file
> - Yes, Freecash

**Claude:** For React Native, TypeScript is the strong recommendation — it gives you type safety for crypto operations where a wrong type can mean lost funds.

## 3. Design Discussion — Round 2: Key Model & TX Strategy

**Claude asked:** How should keys be derived? What is the "password" concept exactly? Which API services? Should UTXO transactions be built locally?

> **Human:**
> - Multiple sources: 1. random; 2. import hex or WIF Base58Check; 3. sha256(secret characters); 4. import pubkey(watch only).
> - The sha256(\<password\>) is used to encrypt keys by AESGCM256 and the former 6 bytes of the sha256x2(\<password\>) is also the account name.
> - Both / configurable
> - Build locally (Recommended)

**Claude:** Excellent — this is a very clear and specific design. Let me confirm my understanding:
- Same private key → derives addresses for all 7 coin types
- Account = password-derived: sha256(password) for AES-GCM-256 encryption, first 6 bytes of sha256(sha256(password)) as hex = account ID
- No BIP39/HD — keys come from: random, hex/WIF import, sha256(user secret), or pubkey-only (watch)

## 4. Design Discussion — Round 3: Address & Scope

**Claude asked:** Account ID displayed as 12-char hex? FCH address format? Start with all features or incrementally?

> **Human:**
> - 12-char hex string
> - Legacy format but Fxxx/3xxxx instead of 1xxxx/3xxxx. The prefix is 0x23
> - Full wallet MVP

**Claude:** Now I have a complete picture. Let me design the architecture.

## 5. Architecture Plan

Claude spent ~4 minutes researching and produced a detailed plan:

- **Project structure:** 8 directories (crypto, coins, account, api, store, screens, components, navigation)
- **Dependencies:** All pure JS crypto (`@noble/secp256k1`, `@noble/hashes`, `@noble/ciphers`)
- **Address derivation:** One pubkey → 7 addresses (BTC `1xxx`, BCH `bitcoincash:qxxx`, FCH `Fxxx`, DOGE `Dxxx`, ETH `0xxx`, USDT/USDC same as ETH)
- **7 phases:** Crypto Core → Account System → UI Shell → API Layer → UTXO TX → ETH TX → Polish

**Claude asked:** Pure JS or native crypto? Expo or bare RN CLI? Use `@bitgo/utxo-lib` or custom BCH sighash?

> **Human:**
> - @noble/ciphers (Recommended)
> - React Native CLI (bare)
> - Custom sighash layer (Recommended)

**Claude:** The plan is ready. Here's what we've agreed on:
- Platform: React Native CLI (bare) + TypeScript
- Crypto: All pure JS
- TX building: Local signing for all coins. Custom ~100-line BCH sighash for BCH/FCH.
- 7 coins: BTC, ETH, BCH, FCH (prefix 0x23), DOGE, USDT, USDC
- APIs: Configurable providers

> **Human:** *(approved the plan)*

## 6. Phase 1 & 2 — Crypto Core + Account System

Claude initialized the React Native project, installed dependencies, and built the cryptographic foundation and account system.

Along the way, several library API issues had to be resolved:
- `@noble/hashes` v2 changed its import paths
- `@noble/secp256k1` v3 moved utility functions to `secp.utils`
- Jest needed ESM transformation configuration for `@noble/*` packages

**Result:** 68 tests passing — covering hashes, encoding, keys, address derivation, account creation, keystore encryption/decryption, and key management.

**Claude:** Shall I continue with Phase 3 (UI Shell)?

> **Human:** Yes, please.

## 7. Phase 3 — UI Shell

Claude built 3 Zustand stores, 10 screens, and a full navigation structure (auth stack + main tabs). Replaced `react-native-mmkv` with `@react-native-async-storage` when the former's native dependency failed to install.

**Result:** 0 TypeScript errors, 68 tests passing, iOS Pods installed. (Could not do iOS build — no Xcode installed in the environment.)

**Claude:** Shall I continue with Phase 4 (API Layer) or Phase 5 (UTXO TX)?

> **Human:** Yes, please. The FCH API is on http://localhost:8081/APIP and the API guide is /Users/liuchangyong/Desktop/Freeverse/Docs/Mycoins-API-Reference.md. Please using the testing prikeys in the document. I have no idea about the APIs of other chains. You can choose them by yourself.

## 8. Phase 4 — API Layer

Claude read the FCH API reference and discovered it uses an unusual encrypted request protocol (`AsyTwoWay / EccK1AesGcm256@No1_NrC7`):

1. ECDH shared secret (client prikey + server pubkey)
2. HKDF-SHA512 key derivation
3. AES-GCM-256 encryption of the request body

The full encryption pipeline was implemented and verified against all test vectors from the API doc. Three providers were built:
- **FreecashAPI** — encrypted APIP protocol for FCH
- **BlockchairAPI** — for BTC, BCH, DOGE
- **EthereumAPI** — JSON-RPC + Etherscan for ETH/USDT/USDC

Integration tests confirmed: the test address had a balance of 489,752,794 satoshis (~4.898 FCH).

**Result:** 77 tests passing (including 5 live API integration tests).

## 9. Phase 5 — UTXO Transaction Building (The Hard Part)

A custom UTXO transaction builder was written from scratch (no `bitcoinjs-lib`): TxWriter buffer helpers, P2PKH scripts, UTXO selection, BIP143 sighash preimage, and signing logic.

### The Schnorr Signature Saga

This became the most dramatic debugging episode of the project.

**Attempt 1 — ECDSA DER signatures:**
Transaction rejected: `"Signature cannot be 65 bytes in CHECKMULTISIG"`.

**Attempt 2 — Compact ECDSA (64 bytes):**
After analyzing a known good FCH transaction (which had 64-byte signatures), tried compact format. Still rejected.

**Attempt 3 — Custom BCH Schnorr (`s = k - e*d`):**
Implemented BCH-style Schnorr. Our own verify passed, but the node rejected it.

**Attempt 4 — Reversed formula (`s = k + e*d`):**
Still rejected.

At this point Claude was stuck and asked:

**Claude:** I'm stuck debugging the FCH Schnorr signature. Do you have any reference code that shows how FCH transactions are signed?

> **Human:** Freecash only allow Schnorr signed TX. The traditional ECDSA signed TX is forbidden.

> **Human:** *(provided path to reference Java code: FC-JDK/SchnorrSignature.java)*

Claude studied the Java implementation and found the correct algorithm:

```
k0 = SHA256(sk || msg) mod n
R  = k0 * G
k  = jacobi(R.y, p) != 1 ? n - k0 : k0
e  = SHA256(R.x || pubkey_compressed || msg) mod n
s  = (e * sk + k) mod n
sig = R.x || s  (64 bytes)
```

Three key differences from our previous attempts:
1. **Nonce derivation:** `SHA256(sk || msg)`, not `SHA256(SHA256(sk) || msg)`
2. **Jacobi symbol** check on R.y
3. **Formula:** `s = (e * sk + k) mod n`

After implementing this, the transaction broadcast **succeeded**:

```
txid: e3ef4b93b3c3fab0d5edf04fd2a9c6c442e28584b4a93e4effac38ad67e049b0
```

**Result:** 94 tests passing, real FCH transaction confirmed on mainnet.

**Claude:** Shall I continue with Phase 6 (ETH/ERC-20)?

> **Human:** Yes, please.

## 10. Phase 6 — ETH/ERC-20 Transactions

Built EIP-1559 Ethereum transactions from scratch (RLP encoding, secp256k1 ECDSA signing, ERC-20 ABI encoding). Created a unified `send-service.ts` that dispatches to the correct builder per coin type. Wired the SendScreen to the real send pipeline.

**Result:** 107 tests passing.

**Claude:** Shall I continue with Phase 7 (Polish)?

> **Human:** Yes, please.

## 11. Phase 7 — Polish

- TX history display on CoinDetailScreen with tappable items
- TxDetailScreen for full transaction info
- Settings persistence with AsyncStorage
- Auto-lock on app background timeout with memory wiping
- Android screenshot prevention (`FLAG_SECURE`)
- Clipboard copy for addresses and TXIDs
- QR code display for receive addresses

## 12. Final Result

**Claude:** All 7 phases are complete.

| Metric | Value |
|--------|-------|
| Source files | 46 |
| Test files | 13 |
| Tests passing | 107 |
| TypeScript errors | 0 |

```
src/
├── crypto/       7 files — hash, keys, encoding, AES, ECDH, Schnorr, address
├── account/      4 files — account, keystore, key-manager, fs-storage
├── coins/        9 files — types, registry, send-service, UTXO common,
│                           BTC/BCH/FCH/DOGE/ETH/ERC-20 tx builders, RLP
├── api/          5 files — types, registry, Freecash/Blockchair/Ethereum providers
├── store/        3 files — account, wallet, settings (Zustand)
├── screens/     10 files — Login, CreateAccount, KeyList, AddKey, Dashboard,
│                           CoinDetail, Send, Receive, TxDetail, Settings
├── components/   1 file  — CoinBalanceCard
├── navigation/   1 file  — RootNavigator
└── utils/        4 files — theme, format, app-lifecycle, global types
```

---

## Takeaways

1. **Talk before code.** Four rounds of Q&A produced an unambiguous spec. No costly rework.
2. **Pure JS crypto works.** `@noble/*` libraries avoided all native build headaches.
3. **Reference code is invaluable.** The Schnorr debugging was only resolved by studying the Java reference. Without it, we'd still be guessing.
4. **Test against reality.** Broadcasting a real transaction on FCH mainnet proved the entire stack worked — no amount of unit tests alone could have given that confidence.
5. **Build incrementally.** Each phase produced working, tested code. No "big bang" integration.
