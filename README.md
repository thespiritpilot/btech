ScoutMarket ⚡ ⚽ 🏈 🏀
An On-Chain Marketplace for Unverifiable Sports Scouting Intelligence

🌐 Live Web3 Dashboard: https://thespiritpilot.github.io/btech/
⚖️ Arbitrator Committee: https://thespiritpilot.github.io/btech/arbitrator.html
🔗 Verified Smart Contract (Sepolia): 0xb69A7Bbbc5d0128BFbFE3D92c5f275B7DAeC5a8B

ScoutMarket is an autonomous agent marketplace designed specifically for trading non-public, unverifiable sports scouting intelligence (prospect draft rankings, soft-tissue injury risk flags, tactical study notes, contract/transfer signals).

Trust Assumptions
This mechanism does not assume honest sellers — it assumes sellers respond to economic incentives. The stake-and-slash design means a seller only has to be trusted up to the value of their stake; beyond that, the protocol enforces honesty via keccak256 hash verification (for the reveal step) and dispute resolution (for the "was this even true" step).

Disputes can be settled two ways: a single trusted arbitrator address (resolveDispute), or a fixed 10-address juror committee (castVote) where 3 accept-votes refunds the buyer and slashes the seller, and an unreachable accept-threshold resolves for the seller instead. The committee proves the mechanism — independent on-chain votes tallied automatically — but not genuine decentralization: all 10 juror keys were generated and are held by one operator for this demo, so it's Sybil-resistant in appearance only. See Known Limitations.

Biggest Design Decision
The core bet was: separate "did the seller deliver what they promised" (mechanically checkable via hash-match, resolved instantly) from "was what they promised actually true" (only checkable much later, once a falsifiable claim resolves in the real world). Most marketplaces conflate these into one dispute mechanism. Splitting them means a buyer has two independent signals — immediate delivery integrity and long-run predictive accuracy — rather than one noisy reputation score blending both.

Live Ethereum Sepolia Deployment & Verified Contract
Contract Address: 0xb69A7Bbbc5d0128BFbFE3D92c5f275B7DAeC5a8B
Verification Status: ✅ Verified on Etherscan (View Verified Source Code)
Deployment Transaction: 0x429928e49a7f58b13a716c3f0ef9e898c4688cc6e34eed7bf7a07a7873cb172e
Arbitrator Address: 0x5AE9102997364E656DE480e20AA4D51c0D8Bf999
Juror Committee: 10 dedicated addresses, registered at deployment, votable via castVote() — keys saved locally to agents/.jurors.json (gitignored) at generation time
Note: an earlier contract (0x2806E4C4c76c25C59b5530E481A2B5cDAA329C32, still viewable on Etherscan) predates the juror committee feature and is no longer the live deployment — its transaction history below (sections 1–4) is kept as a record of the original happy-path/dispute/resolution/interactive flows.

Live Agent Execution Audit (Ethereum Sepolia)
1. Happy-Path Autonomous Agent Loop
Step	Action	Tx Hash / Etherscan Link	Block
1	Seller Staking	0x263a97...9d9f1b	11679888
2	Listing Created	0x537197...1d53ee	11679889
3	Escrow Purchase	0x3f1829...87a2e2	11679890
4	Proof of Reveal	0x506c08...06b4fa	11679891
5	Receipt Confirmed & Released	0xf7382c...d6616f	11679892
2. Dispute & Stake Slashing Loop
Step	Action	Tx Hash / Etherscan Link	Block
1	Listing Created	0x175809...15cf9	11679894
2	Escrow Purchase	0xe24b62...3f0ed8	11679895
3	Seller Reveals	0xff2749...9e4281	11679896
4	Dispute Filed w/ Bond	0x918ec8...1dd468	11679897
5	Arbitrator Ruling & Stake Slashed	0x42bc33...ff8974	11679898
3. Claim Resolution Demo
Step	Action	Tx Hash / Etherscan Link	Block
1	Seller Stake Top-Up	0x92219a...bf5752	11679934
2	Falsifiable Listing Created	0xab3568...646ecb	11679938
3	Escrow Purchase	0x79b35c...1fe316	11679939
4	Proof of Reveal	0xd171a5...c0f21c	11679940
5	Receipt Confirmed	0x2db7da...01846da	11679941
6	Arbitrator Claim Resolution (Accurate)	0x3b8fb0...35ffcd	11679943
4. Interactive "Act as an Agent" Live Flow (Sepolia)
Step	Action	Tx Hash / Etherscan Link	Block
1	Create Listing #5 ([Health Flag] Jaylen Cole — Oregon)	0x28ad94...5a3381	11680199
2	Sell: Create Listing #6 ([Young Star] Devin Brooks — Alabama)	0x3765eb...65369c2	11680231
3	Buy: Escrow Purchase #5	0xc7cc25...8ce7107	11680232
4	Reveal: Seller On-Chain Proof-of-Reveal	0x018b83...561772	11680233
5	Confirm: Buyer Verifies & Releases Escrow	0x4d9c81...dcab8	11680234
5. Juror Committee Voting Loop (current contract, 0xb69A7B...C5a8B)
Full CLI-driven cycle: npm run sell → npm run buy → npm run dispute, resolved by 3 real, distinct juror addresses voting on-chain.

Step	Action	Tx Hash / Etherscan Link
1	Listing Created ([Young Star] Marcus Vance — Georgia)	0xf095884...fdd46e
2	Escrow Purchase #1	0x602cf6b...eac6e03
3	Dispute Filed w/ Bond	0xf0afb04...203c5
4	Juror #0 votes ACCEPT	0xa6a1fc6...8869c6
5	Juror #1 votes ACCEPT	0xeab169d...f994eea
6	Juror #2 votes ACCEPT — threshold hit, auto-resolves	0xa55faf8...943764b
Result: Purchase #1 → Refunded, buyer compensated, seller stake slashed — the instant the 3rd accept vote landed, with no arbitrator involved. A second run with 8 deny votes (Purchase #2) confirmed the opposite path: once accept can no longer mathematically reach 3, it resolves Confirmed (seller wins) automatically instead of deadlocking.

How an Autonomous Agent Actually Connects
The website's "Act as an Agent" panel and arbitrator.html are the stable, tested way to interact with the contract — see the sections above. But it's worth understanding what a real autonomous agent (no human clicking anything) would do instead: it imports the same SellerAgent / BuyerAgent classes from agents/seller_agent.js / agents/buyer_agent.js directly and calls their methods from its own process. "Connecting to the contract" means acquiring four specific things and combining them into one object. Here is each one, concretely, with where it actually comes from in this repo — not a hypothetical.

1. An identity — its own private key. The contract has no login, no API key, no signup. An agent's entire identity is one Ethereum keypair; whatever address that key controls is who the contract thinks is calling. For a brand-new agent, that key doesn't exist until you generate it:

const wallet = ethers.Wallet.createRandom();
console.log(wallet.address, wallet.privateKey); // this IS the agent's identity, nothing more
This repo doesn't make agents generate a fresh key at runtime — it pre-generates dedicated ones per role and stores them in .env (gitignored, never committed): SELLER_PK, BUYER_PK, ARBITRATOR_PK, plus 10 more in agents/.jurors.json for the committee (scripts/setup_jurors.js is literally "generate Wallet.createRandom() × 10 and save the keys"). Whichever key the agent loads is which role it plays — nothing else designates "this is the seller agent" beyond "this process holds SELLER_PK."

2. Gas money. A freshly generated key controls zero ETH and can't send anything, not even a read costs gas but every write does. This repo's scripts/setup_jurors.js funds its 10 new wallets by having the already-funded deployer account send each one 0.0015 ETH — that's the pattern: an existing funded account (or a public Sepolia faucet, for a truly new agent with no operator backing it) has to send the new address some test ETH before it can do anything but read.

3. A network connection — the provider. This is the read-only pipe to Sepolia itself, independent of any identity:

const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
This is the exact URL ui/index.html, ui/arbitrator.html, and every scripts/cli_*.js file all use. Any public Sepolia RPC endpoint works — this one just happens to be free and requires no API key.

4. The contract's address and interface (ABI). The address is fixed and public — 0xb69A7Bbbc5d0128BFbFE3D92c5f275B7DAeC5a8B, saved in this repo's own deployed_addresses.json after deployment. The ABI (which functions exist, their argument types) comes from compiling the Solidity — npm run compile produces it at artifacts/contracts/ScoutMarket.sol/ScoutMarket.json. The browser pages skip that build step and hand-write a minimal ABI array of just the function signatures they call (see the const ABI = [...] block near the top of ui/index.html's <script>) — both are the same interface, just sourced differently.

Put together, this is the whole thing — copy-pasteable, every value real:

const { ethers } = require("ethers");

const CONTRACT_ADDRESS = "0xb69A7Bbbc5d0128BFbFE3D92c5f275B7DAeC5a8B"; // from deployed_addresses.json
const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const wallet = new ethers.Wallet(process.env.SELLER_PK, provider);     // the agent's identity + gas money
const artifact = require("./artifacts/contracts/ScoutMarket.sol/ScoutMarket.json"); // from `npm run compile`
const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

// Sanity-check the connection before doing anything else:
console.log("Connected as:", wallet.address);
console.log("Listings so far:", (await contract.listingCounter()).toString()); // a free read call
After this, contract.listings(id) / contract.purchases(id) / contract.evaluateListing(id) are free reads — no gas, no signature, anyone can call them, even with no wallet at all (that's how the read-only feed in ui/index.html works with no wallet connected). But contract.buyIntel(...), contract.revealIntel(...), contract.castVote(...) — anything that changes state — gets signed by wallet automatically and costs real gas from whatever ETH it holds, the instant you call it. There is no separate "connect" step beyond building this one contract object; every subsequent call either reads for free or signs-and-broadcasts for real, depending only on whether that function is view or not.

Example 1 — the seller side. agents/seller_agent.js has a watchAndAutoReveal() method built for exactly this: a standing loop that polls every 10 seconds and reveals automatically, zero further input needed once started. No terminal runner is wired up to it currently (see Known Limitations) — the method exists in the class, ready to be invoked, but the day-to-day interaction path is the website, not this loop:

async function tick() {
  const purchaseCount = Number(await contract.purchaseCounter());
  for (let id = lastCheckedPurchaseId + 1; id <= purchaseCount; id++) {
    const purchase = await contract.purchases(id);
    if (Number(purchase.status) !== 0) continue;              // not PendingReveal — nothing to do
    const listing = await contract.listings(purchase.listingId);
    if (listing.seller.toLowerCase() !== wallet.address.toLowerCase()) continue; // not our listing
    const plaintext = loadKeystore()[listing.contentCommitment];
    if (!plaintext) continue;
    const tx = await contract.revealIntel(id, plaintext);      // real signed transaction, no human involved
    await tx.wait();
  }
  lastCheckedPurchaseId = purchaseCount;
  setTimeout(tick, 10_000);
}
Example 2 — the buyer side, same pattern, not shipped as a standing script tonight but exactly what evaluateListing() on the contract exists to support:

async function autonomousBuyerLoop() {
  const listingCount = Number(await contract.listingCounter());
  for (let id = 1; id <= listingCount; id++) {
    if (await alreadyOwned(id)) continue;
    const { canPurchase, sellerScoreBps, sellerStake, price } = await contract.evaluateListing(id);
    const passesRiskCheck = canPurchase
      && sellerStake >= ethers.parseEther("0.01")
      && sellerScoreBps >= 2500n; // minimum reputation threshold, tunable per agent

    if (passesRiskCheck) {
      const tx = await contract.buyIntel(id, { value: price }); // the agent decided, on its own, to pay
      await tx.wait();
    }
  }
  setTimeout(autonomousBuyerLoop, 30_000);
}
The contract's evaluateListing() (ScoutMarket.sol:517) returns exactly the tuple this decision needs — it's a read-only function that exists specifically so a buyer agent never has to guess, scrape, or ask a human; the risk check above is the whole "decision engine" the mechanism design section describes, expressed as five lines of JavaScript.

Interactive "Act as an Agent" Web3 Flow
Visitors can connect MetaMask and act directly as a Seller Agent or Buyer Agent on the live website:

Sell Flow:
The user selects a category taxonomy and writes confidential intelligence notes.
The frontend computes keccak256(plaintext) locally and calls createListing via the connected wallet's signer.
The plaintext is cached in browser localStorage keyed by commitment hash.
Buy Flow:
The user browses live listings and clicks Buy for X ETH, locking funds into smart contract escrow.
Reveal & Settlement (My Activity Tab):
When a purchase occurs, the seller navigates to "My Activity" and clicks Submit Proof-of-Reveal (retrieving the cached plaintext to call revealIntel).
The buyer inspects the decrypted intelligence on-chain and clicks Confirm Receipt & Release Escrow.
Client-Side Storage & Reveal Constraint (Known Design Limitation)
Because ScoutMarket is a decentralized client-only static application without a custodial backend database, confidential intelligence plaintext is securely stored in the seller's browser localStorage. To perform the on-chain reveal, the seller must trigger revealIntel from the browser session that originally created the listing. In production autonomous agent deployments, agent processes maintain local encrypted keystores or off-chain state channels (via x402) to automate this reveal.

Arbitrator Committee (arbitrator.html)
A dedicated page (live / ui/arbitrator.html) lists every purchase currently Disputed, with live accept/deny vote tallies read straight from the contract. To cast a vote, paste one of the 10 juror private keys into the page (kept only in that tab's memory — never sent anywhere, never stored) and click Accept or Deny; it submits a real castVote() transaction from that juror's own address. The moment 3 jurors accept, the buyer is refunded and the seller's stake is slashed automatically — no further action needed from anyone. A "Recently Resolved" section shows the final vote tally for every dispute that's already settled.

This is explicitly a UI prototype of committee deliberation, not a decentralized jury: all 10 keys were generated and are held by one operator, so it demonstrates the on-chain mechanism — independent signers, tallied votes, automatic payout — without solving Sybil resistance. See Known Limitations.

Teaser Design & Information Minimization
A fundamental vulnerability of unverifiable intelligence marketplaces is information leakage in the teaser. If a seller posts "Round 1 QB Jaylen Cole - Subscapularis Shoulder Fatigue Pattern", the body part, severity, and draft context are given away for free before the buyer ever locks funds in escrow.

To protect the seller's economic value, ScoutMarket strictly enforces a minimalist teaser format:

[Category] PlayerName — Team
Standard Category Taxonomy:
[Young Star]: Prospect & emerging talent evaluations
[Health Flag]: Medical & injury risk signals
[Career Change]: Transfer, trade, and contract-related intelligence
[Performance Edge]: Tactical, statistical, and film-study breakdowns
[Character Note]: Makeup, work ethic, and locker-room dynamics
Note: Initial historical test listings #1–#3 on Sepolia predate this teaser refinement and remain permanently immutable on-chain. Listing #5 ([Health Flag] Jaylen Cole — Oregon) and all agent generation pipelines forward strictly adhere to this format.

Why Sports Scouting Specifically
Information Decays Fast with Hard Expiry: A scouting report is worthless once the draft begins, transfer window closes, or medicals leak. Contracts strictly enforce expiryTimestamp.
Delayed Falsifiability: Unlike generic data, sports claims eventually resolve in the real world (e.g. "player drafted in Round 2", "player suffers soft-tissue injury in 8 weeks"). This delayed real-world signal provides a concrete verification mechanism.
Repeat Players: Front offices, GM agents, and scouting agencies transact dozens of times across seasons. Staking and reputation compound across trades.
Noise vs. Track Record: Low-barrier entry creates noise. Mandatory stake locking forces skin-in-the-game, while dispute slashing penalizes dishonesty.
Mechanism Design Architecture
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
1. Information Packaging & Expiry
Content Commitment: Seller hashes plaintext intel off-chain using keccak256(plaintextIntel) and commits the hash on-chain.
Redacted Public Teaser: Short public summary (e.g. "Round 1 QB Prospect Shoulder Fatigue Risk - Resolves by Draft Day").
Time Decay & Hard Expiration: Intelligence decays fast. Contracts enforce expiryTimestamp after which purchases are rejected.
Claim Categories:
Falsifiable: Has a concrete claimResolutionTimestamp (e.g. injury within 8 weeks, draft round, contract transfer). Resolves against reality.
Subjective: Film study or qualitative assessment.
2. Seller Staking & Skin-in-the-Game
Sellers must deposit a minimum stake (0.01 ETH) into the contract to list intelligence.
If a seller fails to reveal within the reveal window, or delivers malicious/hash-mismatched content, their stake is slashed (0.005 ETH) and awarded to the buyer as liquidated damages.
3. Payment & Escrow Settlement
Buyer funds lock into an on-chain escrow contract (buyIntel).
Reveal Window & Proof of Reveal: Seller calls revealIntel(purchaseId, plaintext). The contract automatically executes require(keccak256(plaintext) == contentCommitment).
If seller fails to reveal before deadline, buyer calls claimTimeoutRefund() for an automatic refund + seller penalty.
Buyer calls confirmReceipt() to release escrow funds to the seller.
4. Dispute Resolution & Frivolous Dispute Prevention
Buyer can raise a dispute post-reveal (disputePurchase).
Dispute Bond: Buyer must lock a small disputeBond (0.001 ETH) to file a dispute. If the arbitrator rules the dispute was frivolous, the bond is forfeited to the seller.
Arbitration Ruling: If buyer wins, buyer gets full escrow refund + dispute bond refund + slashed seller stake compensation. Seller's dispute loss count is incremented on-chain.
5. Reputation as the Core Decision Engine
Smart contract calculates a composite reputation score (0 to 10,000 basis points) based on:
Total completed sales volume.
Dispute win/loss ratio (40% weight).
Falsifiable claim resolution accuracy (40% weight).
Seller stake magnitude (20% weight).
Buyer Decision Loop: Buyer agents call evaluateListing(listingId) before making a purchase decision: Stake >= 0.01 ETH AND Reputation Score >= Threshold -> APPROVED for Escrow Purchase.
x402 Agent Protocol Integration
ScoutMarket integrates the x402 (HTTP 402 Payment Required) protocol for off-chain agent discovery:

GET /api/intel/:id returns HTTP 402 Payment Required with escrow contract address, price, commitment hash, and step-by-step agent instructions.
Known Limitations
Committee Is Not Actually Decentralized: The 10-juror committee (castVote) proves the on-chain mechanism — independent signers, tallied votes, automatic payout — but all 10 private keys are generated and held by one operator for this demo, same as the single arbitrator (0x5AE9...f999) it sits alongside. Neither is Sybil-resistant. The production path is open staking + random juror sortition (Kleros) or a proposer/dispute-window model (UMA), not a fixed address list.
Oracle Trust & Falsifiability Window: Falsifiable claim resolution currently relies on the arbitrator invoking resolveFalsifiableClaim once claimResolutionTimestamp passes. Autonomous sports oracles (e.g. Chainlink Functions querying official league injury reports / draft feeds) are necessary for full trust minimization.
Collusion & Wash-Trading Rings: While mandatory staking capital (0.01 ETH), dispute bonds (0.001 ETH), and gas fees create financial friction, determined colluding actors could execute wash trades to artificially boost sales counts. Weighting real-world falsifiable claim accuracy over raw volume partially mitigates this, but Sybil-resistant identity staking (e.g. Gitcoin Passport / stake locking period) is needed in production.
Subjective Report Valuation: Qualitative film breakdowns cannot be strictly falsified. While categorized separately, subjective claims rely primarily on post-reveal dispute feedback.
No Terminal/CLI Access: An earlier version of this project included Node.js CLI scripts (npm run sell/buy/dispute) for scripting the full lifecycle outside the browser. They were removed — across different shells (bash, PowerShell, cmd.exe) and machines, environment-variable syntax and working-directory assumptions turned out to be a real, recurring source of user error, and a shaky terminal tool is worse than no terminal tool. The supported way to interact is the website (ui/index.html, ui/arbitrator.html) with a connected wallet, or importing agents/seller_agent.js / agents/buyer_agent.js directly into your own script, as shown above. A properly packaged CLI (a single bundled binary, no shell-specific env-var syntax, no working-directory assumptions) is the correct way to bring this back, not raw node script.js invocations.
Directory Structure
.
├── contracts/
│   └── ScoutMarket.sol        # Core smart contract (Escrow, Staking, Commit-Reveal, Disputes, Committee Voting)
├── agents/
│   ├── seller_agent.js        # Seller agent (Staking, Listing, Proof-of-Reveal, auto-reveal watcher)
│   ├── buyer_agent.js         # Buyer agent (Reputation evaluation, Escrow purchase, Hash verification, disputes)
│   ├── seller_agent.py        # Python Seller Agent implementation
│   ├── buyer_agent.py         # Python Buyer Agent implementation
│   ├── x402_server.js         # x402 HTTP Payment Required Agent API Server
│   ├── .keystore.json         # (gitignored) seller's cached plaintext, keyed by commitment hash
│   └── .jurors.json           # (gitignored) generated juror committee keypairs
├── scripts/
│   ├── deploy.js              # Contract deployment script (arbitrator + juror committee)
│   ├── run_demo.js            # Happy-path execution loop — npm run demo
│   ├── simulate_dispute.js    # Single-arbitrator dispute & stake slashing demo
│   ├── simulate_resolution.js # Falsifiable claim resolution demo
│   └── check-balances.js      # On-chain account balance verifier
├── test/
│   └── ScoutMarket.test.js    # Hardhat unit tests incl. committee voting (13/13 passing)
├── ui/
│   ├── index.html             # Main dashboard — live feed, Run Simulation, Act as an Agent
│   └── arbitrator.html        # Juror committee voting page
├── hardhat.config.js          # Hardhat configuration (Localhost, Base Sepolia, Sepolia)
└── package.json
Everything That Happens, Step by Step
Chain: Ethereum Sepolia, chain ID 11155111. Sepolia specifically because it's Ethereum's primary long-term public testnet — it behaves identically to Ethereum mainnet (same EVM, same gas mechanics, same block structure), but transactions cost free faucet ETH instead of real money, and it has full tooling support: public RPC endpoints, Etherscan verification and block explorer, standard faucets. That combination — genuinely public and independently verifiable, but zero financial risk — is exactly what a demo needing real on-chain proof requires.

Protocol: plain Ethereum L1, nothing else. No rollup, no L2, no batching, no sequencer. Every action below is one standard EIP-1559 (type-2) transaction, signed by a private key, submitted over JSON-RPC to a public Sepolia node, and mined directly into that chain's own blocks. The contract (contracts/ScoutMarket.sol, Solidity ^0.8.24) was deployed once via a normal CREATE transaction and is verified on Etherscan, so anyone can independently confirm every step below actually happened as described.

1. Seller stakes. depositStake() — a plain value-transfer transaction into the contract. Requires ≥ 0.01 ETH total staked before anything else is possible. Why: this is the entire trust model — the protocol doesn't assume honest sellers, it assumes sellers protecting capital they'd lose by cheating.

2. Seller hashes the report — off-chain, before anything touches the chain. keccak256(plaintext) computed locally, in the seller's own browser or script. Nothing is transmitted anywhere yet. Why keccak256: Ethereum's native, cheapest hash opcode — and because the EVM already uses it internally, it costs almost nothing in gas.

3. Seller lists. createListing(hash, teaser, price, expiry, category, resolutionTimestamp) — one transaction. Only the 32-byte hash and a deliberately vague teaser ([Category] Player — Team) go on-chain; the real report is not there. Why: a public blockchain cannot keep anything secret once it's written — the only way to keep the report unavailable before payment is to never put it on-chain at all until later.

4. Buyer evaluates. evaluateListing(id) and getSellerReputation(seller) — both free reads, no gas, no wallet even required. Why free: view functions cost nothing to call because they don't change chain state; this is what lets the live feed work for any visitor with no wallet connected.

5. Buyer pays into escrow. buyIntel(listingId) with msg.value == price — the ETH goes into the contract's balance, not the seller's wallet. A Purchase is created at status PendingReveal with a 1-hour reveal deadline. Why escrow, not direct payment: the buyer's money can't be released until they've actually had a chance to inspect what they paid for — this is the literal mechanism of "buyer protection."

6. Seller reveals. revealIntel(purchaseId, plaintext) — the contract recomputes keccak256(plaintext) and requires it match the commitment from step 3, or the transaction reverts. This is the first moment the real content is ever public. Why the hash check: it's binding — the seller physically cannot submit different content than what they committed to, enforced by math, not trust.

7. Buyer settles, one of two ways:

Confirms — confirmReceipt() releases the escrowed ETH to the seller, updates their completedSales/totalEarnings.
Disputes — disputePurchase(reason) with a 0.001 ETH bond, status becomes Disputed. Why a bond: makes a bad-faith dispute cost something, without blocking a legitimate one.
8. If disputed, one of two independent paths resolves it — both funnel into the same internal _settleDispute():

Single arbitrator — one specific address calls resolveDispute(purchaseId, buyerWins, details) directly, unilaterally.
10-person juror committee — any of 10 registered addresses calls castVote(purchaseId, accept), one vote per juror, each its own transaction. The instant accept-votes hits 3, or deny-votes passes 7 (making 3 mathematically unreachable), the contract auto-settles in that same transaction — no separate finalize step, no way to get stuck. Why both exist: the committee is the more credible mechanism (independent signers, not one address), but neither is actually decentralized yet — see Known Limitations — so the simpler override stays as a fallback.
9. Payout. Buyer wins → refunded escrow + bond + a 0.005 ETH slash taken from the seller's stake. Seller wins → keeps the escrow and the buyer's forfeited bond. Why slash the loser's stake specifically: it's the same capital from step 1 — the whole reason staking exists is to have something real to take.

10. Reputation updates. calculateReputationScore() recomputes a 0–10,000 bps score from dispute win-rate (40%), falsifiable-claim accuracy (40%), and sales volume (20%) — read by every future buyer's evaluateListing() call before they decide whether to trust this seller at all. Why split delivery-integrity from truth-verification in the first place (the biggest design decision, stated once more here for completeness): one is checkable instantly by hash, the other only resolves once reality — or a jury — weighs in later, and conflating them into one score would hide which kind of failure actually happened.
