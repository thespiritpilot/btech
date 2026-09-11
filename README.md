# ScoutMarket ⚡ ⚽ 🏈 🏀
> **An On-Chain Marketplace for Unverifiable Sports Scouting Intelligence**

🌐 **Live Web3 Dashboard**: [https://thespiritpilot.github.io/btech/](https://thespiritpilot.github.io/btech/)  
🔗 **Verified Smart Contract (Sepolia)**: [`0x2806E4C4c76c25C59b5530E481A2B5cDAA329C32`](https://sepolia.etherscan.io/address/0x2806E4C4c76c25C59b5530E481A2B5cDAA329C32#code)

ScoutMarket is an autonomous agent marketplace designed specifically for trading non-public, unverifiable sports scouting intelligence (prospect draft rankings, soft-tissue injury risk flags, tactical study notes, contract/transfer signals).

---

## Trust Assumptions

This mechanism does not assume honest sellers — it assumes sellers respond to economic incentives. The stake-and-slash design means a seller only has to be trusted up to the value of their stake; beyond that, the protocol enforces honesty via keccak256 hash verification (for the reveal step) and arbitration (for the "was this even true" step). The one thing the protocol cannot mechanically enforce is arbitrator honesty itself — that's a single trusted address for this demo, discussed under Known Limitations.

## Biggest Design Decision

The core bet was: separate "did the seller deliver what they promised" (mechanically checkable via hash-match, resolved instantly) from "was what they promised actually true" (only checkable much later, once a falsifiable claim resolves in the real world). Most marketplaces conflate these into one dispute mechanism. Splitting them means a buyer has two independent signals — immediate delivery integrity and long-run predictive accuracy — rather than one noisy reputation score blending both.

---

## Live Ethereum Sepolia Deployment & Verified Contract

- **Contract Address**: [`0x2806E4C4c76c25C59b5530E481A2B5cDAA329C32`](https://sepolia.etherscan.io/address/0x2806E4C4c76c25C59b5530E481A2B5cDAA329C32#code)
- **Verification Status**: ✅ **Verified on Etherscan** ([View Verified Source Code](https://sepolia.etherscan.io/address/0x2806E4C4c76c25C59b5530E481A2B5cDAA329C32#code))
- **Deployment Transaction**: [`0x58e17b6c77eecc47681e301a3214e3bfa2d2a10b81c452d24c6daba42289fd99`](https://sepolia.etherscan.io/tx/0x58e17b6c77eecc47681e301a3214e3bfa2d2a10b81c452d24c6daba42289fd99) *(Block 11679885)*
- **Arbitrator Address**: `0x5AE9102997364E656DE480e20AA4D51c0D8Bf999`

---

## Live Agent Execution Audit (Ethereum Sepolia)

### 1. Happy-Path Autonomous Agent Loop
| Step | Action | Tx Hash / Etherscan Link | Block |
| :--- | :--- | :--- | :--- |
| 1 | **Seller Staking** | [`0x263a97...9d9f1b`](https://sepolia.etherscan.io/tx/0x263a97e196fc42dcc637ea5b47f6f072998e3b571f9fe7467eea6b53629d9f1b) | 11679888 |
| 2 | **Listing Created** | [`0x537197...1d53ee`](https://sepolia.etherscan.io/tx/0x5371978b80a5e5a04f6a75dedd93d571cb59da6f18b3514e2c0aa903591d53ee) | 11679889 |
| 3 | **Escrow Purchase** | [`0x3f1829...87a2e2`](https://sepolia.etherscan.io/tx/0x3f1829567136862b63782125ba5047bc7069fbff47d6002c4ce30fac3f87a2e2) | 11679890 |
| 4 | **Proof of Reveal** | [`0x506c08...06b4fa`](https://sepolia.etherscan.io/tx/0x506c0826308ada2ab28a7ee748146539b422c8c214c3b6ec1c399dd5ad06b4fa) | 11679891 |
| 5 | **Receipt Confirmed & Released** | [`0xf7382c...d6616f`](https://sepolia.etherscan.io/tx/0xf7382c73255f8a5d925195ce732554352d01f02d7d1057e37af8254d31d6616f) | 11679892 |

### 2. Dispute & Stake Slashing Loop
| Step | Action | Tx Hash / Etherscan Link | Block |
| :--- | :--- | :--- | :--- |
| 1 | **Listing Created** | [`0x175809...15cf9`](https://sepolia.etherscan.io/tx/0x175809dd83566602f949b8f71f289ebe8281f5ffbdfae6ea3c13d5df25415cf9) | 11679894 |
| 2 | **Escrow Purchase** | [`0xe24b62...3f0ed8`](https://sepolia.etherscan.io/tx/0xe24b625207a23365c1c19ac2e47e9d116b18e68977b2c70bef45e614373f0ed8) | 11679895 |
| 3 | **Seller Reveals** | [`0xff2749...9e4281`](https://sepolia.etherscan.io/tx/0xff2749dea6df505d63a0e324424aa925474c3721a542f205cf720aa28d9e4281) | 11679896 |
| 4 | **Dispute Filed w/ Bond** | [`0x918ec8...1dd468`](https://sepolia.etherscan.io/tx/0x918ec838319fee8025673dfeec1e8d5933cc343c046b48408a44b98b091dd468) | 11679897 |
| 5 | **Arbitrator Ruling & Stake Slashed** | [`0x42bc33...ff8974`](https://sepolia.etherscan.io/tx/0x42bc33319f8f1163dbff932b3fabe694122d7a6bef31dfb6c4a4392b67ff8974) | 11679898 |

### 3. Claim Resolution Demo
| Step | Action | Tx Hash / Etherscan Link | Block |
| :--- | :--- | :--- | :--- |
| 1 | **Seller Stake Top-Up** | [`0x92219a...bf5752`](https://sepolia.etherscan.io/tx/0x92219aa50e470b26a03350f00ceeb454fa81264708ecf4f65462dc2c19bf5752) | 11679934 |
| 2 | **Falsifiable Listing Created** | [`0xab3568...646ecb`](https://sepolia.etherscan.io/tx/0xab356818c9fd1f98dc9d55ca98ea9e1146c5ab01eb6dfdd5c7966a12ea646ecb) | 11679938 |
| 3 | **Escrow Purchase** | [`0x79b35c...1fe316`](https://sepolia.etherscan.io/tx/0x79b35ce53a9b9750d4f09c6461fdb7ee7e4388f02d75b26efa8342cfd81fe316) | 11679939 |
| 4 | **Proof of Reveal** | [`0xd171a5...c0f21c`](https://sepolia.etherscan.io/tx/0xd171a5ab497fc85903fab3176b98c85cade6bbe0e1d48cf2b6cb0e216cc0f21c) | 11679940 |
| 5 | **Receipt Confirmed** | [`0x2db7da...01846da`](https://sepolia.etherscan.io/tx/0x2db7da2bef8ae9623540ec10a1b3efb736aed498ca5cfd3546843eb1001846da) | 11679941 |
| 6 | **Arbitrator Claim Resolution (Accurate)** | [`0x3b8fb0...35ffcd`](https://sepolia.etherscan.io/tx/0x3b8fb0274d65d3febc9c4e45b857936de73aa11d877ac113c571e487fa35ffcd) | 11679943 |

---

## Why Sports Scouting Specifically

1. **Information Decays Fast with Hard Expiry**: A scouting report is worthless once the draft begins, transfer window closes, or medicals leak. Contracts strictly enforce `expiryTimestamp`.
2. **Delayed Falsifiability**: Unlike generic data, sports claims eventually resolve in the real world (e.g. "player drafted in Round 2", "player suffers soft-tissue injury in 8 weeks"). This delayed real-world signal provides a concrete verification mechanism.
3. **Repeat Players**: Front offices, GM agents, and scouting agencies transact dozens of times across seasons. Staking and reputation compound across trades.
4. **Noise vs. Track Record**: Low-barrier entry creates noise. Mandatory stake locking forces skin-in-the-game, while dispute slashing penalizes dishonesty.

---

## Mechanism Design Architecture

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 SCOUTMARKET CONTRACT                    │
                  └─────────────────────────────────────────────────────────┘
                                   ▲                       ▲
              1. Stake 0.01+ ETH   │                       │ 3. Lock Escrow Payment
             ┌─────────────────────┘                       └─────────────────────┐
             │                                                                   │
   ┌──────────────────┐  2. Post Listing (Teaser + Commitment Hash)   ┌──────────────────┐
   │   Seller Agent   │──────────────────────────────────────────────>│   Buyer Agent    │
   │  (Scout / Model) │                                               │  (GM / Agency)   │
   └──────────────────┘<──────────────────────────────────────────────└──────────────────┘
             │           4. Submit Proof of Reveal (Plaintext)                   │
             │           5. Contract Verifies keccak256(plaintext) == Hash       │
             └───────────────────────────────────────────────────────────────────┘
                         6. Buyer Confirms -> Escrow Released to Seller
                         (OR Dispute Raised -> Arbitrator Slashes Stake)
```

### 1. Information Packaging & Expiry
- **Content Commitment**: Seller hashes plaintext intel off-chain using `keccak256(plaintextIntel)` and commits the hash on-chain.
- **Redacted Public Teaser**: Short public summary (e.g. *"Round 1 QB Prospect Shoulder Fatigue Risk - Resolves by Draft Day"*).
- **Time Decay & Hard Expiration**: Intelligence decays fast. Contracts enforce `expiryTimestamp` after which purchases are rejected.
- **Claim Categories**:
  - `Falsifiable`: Has a concrete `claimResolutionTimestamp` (e.g. injury within 8 weeks, draft round, contract transfer). Resolves against reality.
  - `Subjective`: Film study or qualitative assessment.

### 2. Seller Staking & Skin-in-the-Game
- Sellers **must deposit a minimum stake (`0.01 ETH`)** into the contract to list intelligence.
- If a seller fails to reveal within the reveal window, or delivers malicious/hash-mismatched content, their stake is **slashed (`0.005 ETH`)** and awarded to the buyer as liquidated damages.

### 3. Payment & Escrow Settlement
- Buyer funds lock into an on-chain escrow contract (`buyIntel`).
- **Reveal Window & Proof of Reveal**: Seller calls `revealIntel(purchaseId, plaintext)`. The contract automatically executes `require(keccak256(plaintext) == contentCommitment)`.
- If seller fails to reveal before deadline, buyer calls `claimTimeoutRefund()` for an automatic refund + seller penalty.
- Buyer calls `confirmReceipt()` to release escrow funds to the seller.

### 4. Dispute Resolution & Frivolous Dispute Prevention
- Buyer can raise a dispute post-reveal (`disputePurchase`).
- **Dispute Bond**: Buyer must lock a small `disputeBond` (`0.001 ETH`) to file a dispute. If the arbitrator rules the dispute was frivolous, the bond is forfeited to the seller.
- **Arbitration Ruling**: If buyer wins, buyer gets full escrow refund + dispute bond refund + slashed seller stake compensation. Seller's dispute loss count is incremented on-chain.

### 5. Reputation as the Core Decision Engine
- Smart contract calculates a composite reputation score (0 to 10,000 basis points) based on:
  - Total completed sales volume.
  - Dispute win/loss ratio (40% weight).
  - Falsifiable claim resolution accuracy (40% weight).
  - Seller stake magnitude (20% weight).
- **Buyer Decision Loop**: Buyer agents call `evaluateListing(listingId)` before making a purchase decision:
  `Stake >= 0.01 ETH` AND `Reputation Score >= Threshold` -> **APPROVED for Escrow Purchase**.

---

## x402 Agent Protocol Integration

ScoutMarket integrates the **x402 (HTTP 402 Payment Required)** protocol for off-chain agent discovery:
- `GET /api/intel/:id` returns `HTTP 402 Payment Required` with escrow contract address, price, commitment hash, and step-by-step agent instructions.

---

## Known Limitations

- **Centralized Arbitrator Address**: The arbitrator is currently a single trusted address (`0x5AE9...f999`) rather than a decentralized jury network. The production path requires integrating an optimistic oracle or jury system (such as Kleros or UMA).
- **Oracle Trust & Falsifiability Window**: Falsifiable claim resolution currently relies on the arbitrator invoking `resolveFalsifiableClaim` once `claimResolutionTimestamp` passes. Autonomous sports oracles (e.g. Chainlink Functions querying official league injury reports / draft feeds) are necessary for full trust minimization.
- **Collusion & Wash-Trading Rings**: While mandatory staking capital (`0.01 ETH`), dispute bonds (`0.001 ETH`), and gas fees create financial friction, determined colluding actors could execute wash trades to artificially boost sales counts. Weighting real-world falsifiable claim accuracy over raw volume partially mitigates this, but Sybil-resistant identity staking (e.g. Gitcoin Passport / stake locking period) is needed in production.
- **Subjective Report Valuation**: Qualitative film breakdowns cannot be strictly falsified. While categorized separately, subjective claims rely primarily on post-reveal dispute feedback.

---

## Directory Structure

```
.
├── contracts/
│   └── ScoutMarket.sol        # Core smart contract (Escrow, Staking, Commit-Reveal, Disputes, Resolution)
├── agents/
│   ├── seller_agent.js        # Seller agent (Staking, Listing, Proof-of-Reveal)
│   ├── buyer_agent.js         # Buyer agent (Reputation evaluation, Escrow purchase, Hash verification)
│   ├── seller_agent.py        # Python Seller Agent implementation
│   ├── buyer_agent.py         # Python Buyer Agent implementation
│   └── x402_server.js         # x402 HTTP Payment Required Agent API Server
├── scripts/
│   ├── deploy.js              # Contract deployment script
│   ├── run_demo.js            # Happy-path execution loop
│   ├── simulate_dispute.js    # Dispute & stake slashing demo
│   ├── simulate_resolution.js # Falsifiable claim resolution demo
│   └── check-balances.js      # On-chain account balance verifier
├── test/
│   └── ScoutMarket.test.js    # Comprehensive Hardhat unit tests (8/8 passing)
├── ui/
│   └── index.html             # Single-page dashboard UI
├── hardhat.config.js          # Hardhat configuration (Localhost, Base Sepolia, Sepolia)
└── package.json
```
