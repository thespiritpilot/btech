const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

class SellerAgent {
  constructor(signer, contractAddress, contractAbi) {
    this.signer = signer;
    this.contract = new ethers.Contract(contractAddress, contractAbi, signer);
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
    const { teaser, plaintextIntel, priceEth, expiryHours, category, resolutionDays } = intelPackage;

    const priceWei = ethers.parseEther(priceEth);
    const commitmentHash = ethers.keccak256(ethers.toUtf8Bytes(plaintextIntel));
    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + expiryHours * 3600;
    const resolutionTimestamp = now + resolutionDays * 86400;

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
    return { listingId, commitmentHash, plaintextIntel, txHash: tx.hash };
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
