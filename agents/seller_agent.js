const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Standard Minimalist Categories (withholds proprietary intel specifics pre-purchase)
const TEASER_CATEGORIES = {
  YOUNG_STAR: "Young Star",         // Prospect / talent evaluation
  HEALTH_FLAG: "Health Flag",       // Medical / injury risk
  CAREER_CHANGE: "Career Change",   // Transfer / trade / contract signal
  PERFORMANCE_EDGE: "Performance Edge", // Tactical / film / statistical study
  CHARACTER_NOTE: "Character Note"  // Locker-room / makeup / work ethic
};

// Local keystore so a long-running seller process (watchAndAutoReveal) can look up
// the plaintext for a commitment hash without keeping everything in memory. Mirrors
// the browser UI's localStorage cache, but for a Node-based autonomous seller agent.
// Gitignored — this holds confidential intel plaintext, never commit it.
const KEYSTORE_PATH = path.join(__dirname, ".keystore.json");

function loadKeystore() {
  try {
    if (fs.existsSync(KEYSTORE_PATH)) {
      return JSON.parse(fs.readFileSync(KEYSTORE_PATH, "utf8"));
    }
  } catch (e) {
    console.warn(`[Seller Agent] Could not read keystore (${KEYSTORE_PATH}): ${e.message}`);
  }
  return {};
}

function saveToKeystore(commitmentHash, plaintextIntel) {
  const store = loadKeystore();
  store[commitmentHash] = plaintextIntel;
  fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(store, null, 2));
}

class SellerAgent {
  constructor(signer, contractAddress, contractAbi) {
    this.signer = signer;
    this.contract = new ethers.Contract(contractAddress, contractAbi, signer);
  }

  static formatTeaser(category, playerName, team) {
    return `[${category}] ${playerName} — ${team}`;
  }

  async ensureStake(minStakeEth = "0.01") {
    const minStakeWei = ethers.parseEther(minStakeEth);
    const rep = await this.contract.getSellerReputation(this.signer.address);
    console.log(`[Seller Agent] Current stake: ${ethers.formatEther(rep.stake)} ETH`);

    if (rep.stake < minStakeWei) {
      const depositAmount = minStakeWei - rep.stake;
      console.log(`[Seller Agent] Depositing ${ethers.formatEther(depositAmount)} ETH stake to satisfy skin-in-the-game requirement...`);
      const tx = await this.contract.depositStake({ value: depositAmount });
      await tx.wait();
      console.log(`[Seller Agent] Stake deposit confirmed. Tx: ${tx.hash}`);
    }
  }

  async createScoutingListing(intelPackage) {
    let { teaser, categoryTag, playerName, team, plaintextIntel, priceEth, expiryHours, category, resolutionDays } = intelPackage;

    // Use tightened format if components are provided
    if (!teaser && categoryTag && playerName && team) {
      teaser = SellerAgent.formatTeaser(categoryTag, playerName, team);
    }

    const priceWei = ethers.parseEther(priceEth);
    const commitmentHash = ethers.keccak256(ethers.toUtf8Bytes(plaintextIntel));
    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + expiryHours * 3600;
    const resolutionTimestamp = now + (resolutionDays || 7) * 86400;

    console.log(`[Seller Agent] Creating listing: "${teaser}"`);
    console.log(`[Seller Agent] Price: ${priceEth} ETH | Commitment: ${commitmentHash}`);

    const tx = await this.contract.createListing(
      commitmentHash,
      teaser,
      priceWei,
      expiryTimestamp,
      category === "Falsifiable" ? 0 : 1,
      resolutionTimestamp
    );
    const receipt = await tx.wait();

    // Extract listingId from event
    let listingId = 1;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed && parsed.name === "ListingCreated") {
          listingId = parsed.args.listingId;
          break;
        }
      } catch (e) {}
    }

    // Cache the plaintext locally, keyed by its commitment hash, so
    // watchAndAutoReveal() can reveal it the instant a purchase comes in
    // without needing it held in memory across process restarts.
    saveToKeystore(commitmentHash, plaintextIntel);

    console.log(`[Seller Agent] Listing #${listingId} created on-chain! Tx: ${tx.hash}`);
    return { listingId, commitmentHash, plaintextIntel, txHash: tx.hash, teaser };
  }

  async revealIntelForPurchase(purchaseId, plaintextIntel) {
    console.log(`[Seller Agent] Revealing intel for purchase #${purchaseId}...`);
    const tx = await this.contract.revealIntel(purchaseId, plaintextIntel);
    const receipt = await tx.wait();
    console.log(`[Seller Agent] Intel revealed on-chain! Tx: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Polls for new purchases against this seller's own listings and reveals
   * them automatically (within one poll interval of the buy transaction
   * confirming), using the local keystore populated by createScoutingListing.
   * Public RPC endpoints generally don't support reliable eth_subscribe, so
   * this uses polling rather than an event subscription.
   *
   * Returns a stop() function to end the watch loop.
   */
  watchAndAutoReveal({ pollIntervalMs = 10_000 } = {}) {
    let stopped = false;
    let lastCheckedPurchaseId = 0;
    const listingSellerCache = new Map(); // listingId -> { isOurs, contentCommitment }

    const isOurListing = async (listingId) => {
      const key = listingId.toString();
      if (listingSellerCache.has(key)) return listingSellerCache.get(key);
      const listing = await this.contract.listings(listingId);
      const info = {
        isOurs: listing.seller.toLowerCase() === this.signer.address.toLowerCase(),
        contentCommitment: listing.contentCommitment
      };
      listingSellerCache.set(key, info);
      return info;
    };

    const tick = async () => {
      try {
        const purchaseCount = Number(await this.contract.purchaseCounter());
        for (let id = lastCheckedPurchaseId + 1; id <= purchaseCount; id++) {
          const purchase = await this.contract.purchases(id);
          if (Number(purchase.status) !== 0) continue; // not PendingReveal

          const { isOurs, contentCommitment } = await isOurListing(purchase.listingId);
          if (!isOurs) continue;

          const plaintext = loadKeystore()[contentCommitment];
          if (!plaintext) {
            console.warn(`[Seller Agent] Purchase #${id} (listing #${purchase.listingId}): no cached plaintext for this commitment — cannot auto-reveal.`);
            continue;
          }

          console.log(`[Seller Agent] Purchase #${id} detected on listing #${purchase.listingId}. Auto-revealing...`);
          try {
            await this.revealIntelForPurchase(id, plaintext);
          } catch (revealErr) {
            console.error(`[Seller Agent] Auto-reveal failed for purchase #${id}: ${revealErr.message}`);
          }
        }
        lastCheckedPurchaseId = purchaseCount;
      } catch (err) {
        console.error(`[Seller Agent] Watch poll error: ${err.message}`);
      }
      if (!stopped) {
        this._watchTimer = setTimeout(tick, pollIntervalMs);
      }
    };

    console.log(`[Seller Agent] Watching for purchases on listings sold by ${this.signer.address} (poll every ${pollIntervalMs / 1000}s)...`);
    tick();

    return () => {
      stopped = true;
      if (this._watchTimer) clearTimeout(this._watchTimer);
    };
  }
}

module.exports = SellerAgent;
module.exports.TEASER_CATEGORIES = TEASER_CATEGORIES;

