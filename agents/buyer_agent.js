const { ethers } = require("ethers");

class BuyerAgent {
  constructor(signer, contractAddress, contractAbi) {
    this.signer = signer;
    this.contract = new ethers.Contract(contractAddress, contractAbi, signer);
  }

  async evaluateListing(listingId) {
    console.log(`[Buyer Agent] Evaluating Listing #${listingId} on-chain...`);
    const evalData = await this.contract.evaluateListing(listingId);

    const [isValid, canPurchase, sellerScoreBps, sellerStake, price] = evalData;

    const listing = await this.contract.listings(listingId);
    const sellerRep = await this.contract.getSellerReputation(listing.seller);

    console.log(`[Buyer Agent] Teaser: "${listing.teaser}"`);
    console.log(`[Buyer Agent] Price: ${ethers.formatEther(price)} ETH`);
    console.log(`[Buyer Agent] Seller Stake: ${ethers.formatEther(sellerStake)} ETH`);
    console.log(`[Buyer Agent] Seller Score: ${sellerScoreBps.toString()} bps (${(Number(sellerScoreBps)/100).toFixed(1)}%)`);
    console.log(`[Buyer Agent] Seller Sales Track Record: ${sellerRep.completedSales.toString()} completed sales`);

    // Decision Logic: Blind Purchase Risk Assessment
    const minStakeWei = ethers.parseEther("0.01");
    const minScoreBps = 2500; // Minimum 25% reputation threshold for trial purchase

    let decision = {
      shouldBuy: false,
      reason: ""
    };

    if (!isValid || !canPurchase) {
      decision.reason = "Listing is invalid or expired";
    } else if (sellerStake < minStakeWei) {
      decision.reason = "Seller has insufficient stake locked (lacks skin in the game)";
    } else if (sellerScoreBps < minScoreBps) {
      decision.reason = `Seller reputation score (${sellerScoreBps}) is below minimum threshold (${minScoreBps})`;
    } else {
      decision.shouldBuy = true;
      decision.reason = `Passed risk check: Stake (${ethers.formatEther(sellerStake)} ETH >= 0.01 ETH), Score (${sellerScoreBps} bps >= ${minScoreBps} bps)`;
    }

    console.log(`[Buyer Agent] Decision Outcome: ${decision.shouldBuy ? "APPROVED" : "REJECTED"} -> ${decision.reason}`);
    return { ...decision, price, seller: listing.seller, commitment: listing.contentCommitment };
  }

  async purchaseIntel(listingId, priceWei) {
    console.log(`[Buyer Agent] Initiating Escrow Purchase for Listing #${listingId}...`);
    const tx = await this.contract.buyIntel(listingId, { value: priceWei });
    const receipt = await tx.wait();

    let purchaseId = 1;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed && parsed.name === "IntelPurchased") {
          purchaseId = parsed.args.purchaseId;
          break;
        }
      } catch (e) {}
    }

    console.log(`[Buyer Agent] Payment of ${ethers.formatEther(priceWei)} ETH locked in Escrow! Purchase #${purchaseId}. Tx: ${tx.hash}`);
    return { purchaseId, txHash: tx.hash };
  }

  async verifyAndConfirm(purchaseId, expectedCommitment) {
    console.log(`[Buyer Agent] Inspecting revealed content for Purchase #${purchaseId}...`);
    const purchase = await this.contract.purchases(purchaseId);

    if (purchase.status !== 1n && purchase.status !== 1) { // PurchaseStatus.Revealed
      throw new Error(`Purchase status is not Revealed (status: ${purchase.status})`);
    }

    const revealedText = purchase.revealedContent;
    console.log(`[Buyer Agent] Received Revealed Content: "${revealedText}"`);

    // Verify hash commitment on-chain / off-chain
    const computedHash = ethers.keccak256(ethers.toUtf8Bytes(revealedText));
    if (computedHash !== expectedCommitment) {
      console.log(`[Buyer Agent] ALERT: Hash mismatch! Expected ${expectedCommitment}, got ${computedHash}`);
      return { verified: false, revealedText };
    }

    console.log(`[Buyer Agent] Hash match verified! Confirming receipt and releasing escrow...`);
    const tx = await this.contract.confirmReceipt(purchaseId);
    await tx.wait();
    console.log(`[Buyer Agent] Escrow released to seller! Tx: ${tx.hash}`);
    return { verified: true, revealedText, txHash: tx.hash };
  }

  async raiseDispute(purchaseId, reason, disputeBondEth = "0.001") {
    console.log(`[Buyer Agent] Raising dispute for Purchase #${purchaseId}. Reason: "${reason}"`);
    const disputeBondWei = ethers.parseEther(disputeBondEth);
    const tx = await this.contract.disputePurchase(purchaseId, reason, { value: disputeBondWei });
    await tx.wait();
    console.log(`[Buyer Agent] Dispute filed on-chain! Tx: ${tx.hash}`);
    return tx.hash;
  }
}

module.exports = BuyerAgent;
