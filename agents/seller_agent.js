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
}

module.exports = SellerAgent;
module.exports.TEASER_CATEGORIES = TEASER_CATEGORIES;

