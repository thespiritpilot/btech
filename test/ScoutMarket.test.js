const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ScoutMarket Unit Tests", function () {
  let ScoutMarket;
  let scoutMarket;
  let owner, seller, buyer, arbitrator, otherAccount;

  const minSellerStake = ethers.parseEther("0.01");
  const disputeBond = ethers.parseEther("0.001");
  const intelPrice = ethers.parseEther("0.05");
  const plaintextIntel = "PROSPECT REPORT #84: WR Marcus Vance - High hamstring tendonitis risk. Medical red flag flag by Dr. Cole.";
  const intelHash = ethers.keccak256(ethers.toUtf8Bytes(plaintextIntel));

  beforeEach(async function () {
    [owner, seller, buyer, arbitrator, otherAccount] = await ethers.getSigners();

    ScoutMarket = await ethers.getContractFactory("ScoutMarket");
    scoutMarket = await ScoutMarket.deploy(arbitrator.address);
    await scoutMarket.waitForDeployment();
  });

  describe("Seller Staking", function () {
    it("Should allow seller to deposit stake and track balance", async function () {
      await scoutMarket.connect(seller).depositStake({ value: minSellerStake });
      const rep = await scoutMarket.getSellerReputation(seller.address);
      expect(rep.stake).to.equal(minSellerStake);
    });

    it("Should prevent listing if seller has insufficient stake", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 3600;
      const resolution = now + 86400;

      await expect(
        scoutMarket.connect(seller).createListing(
          intelHash,
          "Round 2 WR Prospect Injury Risk",
          intelPrice,
          expiry,
          0, // Falsifiable
          resolution
        )
      ).to.be.revertedWith("Seller stake below required minimum");
    });
  });

  describe("Listing & Escrow Purchase Flow", function () {
    let listingId;

    beforeEach(async function () {
      await scoutMarket.connect(seller).depositStake({ value: minSellerStake });
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 3600;
      const resolution = now + 86400;

      const tx = await scoutMarket.connect(seller).createListing(
        intelHash,
        "Round 2 WR Prospect Injury Risk",
        intelPrice,
        expiry,
        0, // Falsifiable
        resolution
      );
      await tx.wait();
      listingId = 1;
    });

    it("Should allow buyer to purchase intel and hold funds in escrow", async function () {
      const tx = await scoutMarket.connect(buyer).buyIntel(listingId, { value: intelPrice });
      await tx.wait();

      const purchase = await scoutMarket.purchases(1);
      expect(purchase.buyer).to.equal(buyer.address);
      expect(purchase.amountPaid).to.equal(intelPrice);
      expect(purchase.status).to.equal(0); // PendingReveal
    });

    it("Should allow seller to reveal matching intel content", async function () {
      await scoutMarket.connect(buyer).buyIntel(listingId, { value: intelPrice });

      await expect(scoutMarket.connect(seller).revealIntel(1, plaintextIntel))
        .to.emit(scoutMarket, "IntelRevealed")
        .withArgs(1, plaintextIntel);

      const purchase = await scoutMarket.purchases(1);
      expect(purchase.status).to.equal(1); // Revealed
      expect(purchase.revealedContent).to.equal(plaintextIntel);
    });

    it("Should revert reveal if content hash does not match commitment", async function () {
      await scoutMarket.connect(buyer).buyIntel(listingId, { value: intelPrice });

      await expect(
        scoutMarket.connect(seller).revealIntel(1, "Fake fake fake content")
      ).to.be.revertedWith("Commitment hash mismatch! Delivered content does not match commitment.");
    });

    it("Should allow buyer to confirm receipt and release funds to seller", async function () {
      await scoutMarket.connect(buyer).buyIntel(listingId, { value: intelPrice });
      await scoutMarket.connect(seller).revealIntel(1, plaintextIntel);

      const initialSellerBal = await ethers.provider.getBalance(seller.address);
      const tx = await scoutMarket.connect(buyer).confirmReceipt(1);
      await tx.wait();

      const finalSellerBal = await ethers.provider.getBalance(seller.address);
      expect(finalSellerBal).to.be.above(initialSellerBal);

      const rep = await scoutMarket.getSellerReputation(seller.address);
      expect(rep.completedSales).to.equal(1);
    });
  });

  describe("Dispute Resolution & Stake Slashing", function () {
    let listingId;

    beforeEach(async function () {
      await scoutMarket.connect(seller).depositStake({ value: minSellerStake });
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 3600;
      const resolution = now + 86400;

      await scoutMarket.connect(seller).createListing(
        intelHash,
        "Round 2 WR Prospect Injury Risk",
        intelPrice,
        expiry,
        0,
        resolution
      );
      listingId = 1;
      await scoutMarket.connect(buyer).buyIntel(listingId, { value: intelPrice });
      await scoutMarket.connect(seller).revealIntel(1, plaintextIntel);
    });

    it("Should allow buyer to dispute with dispute bond", async function () {
      await expect(
        scoutMarket.connect(buyer).disputePurchase(1, "Claim material details missing", { value: disputeBond })
      )
        .to.emit(scoutMarket, "DisputeRaised")
        .withArgs(1, buyer.address, "Claim material details missing");

      const purchase = await scoutMarket.purchases(1);
      expect(purchase.status).to.equal(4); // Disputed
    });

    it("Arbitrator ruling in favor of buyer slashes seller stake and refunds buyer", async function () {
      await scoutMarket.connect(buyer).disputePurchase(1, "Claim material details missing", { value: disputeBond });

      const initialBuyerBal = await ethers.provider.getBalance(buyer.address);
      const tx = await scoutMarket.connect(arbitrator).resolveDispute(1, true, "Seller delivered misleading intel");
      await tx.wait();

      const finalBuyerBal = await ethers.provider.getBalance(buyer.address);
      expect(finalBuyerBal).to.be.above(initialBuyerBal);

      const rep = await scoutMarket.getSellerReputation(seller.address);
      expect(rep.disputesLost).to.equal(1);
    });
  });
});
