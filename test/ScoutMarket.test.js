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
    scoutMarket = await ScoutMarket.deploy(arbitrator.address, []);
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
          "[Health Flag] Marcus Vance — Georgia",
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
        "[Health Flag] Marcus Vance — Georgia",
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

  describe("Committee Voting (castVote)", function () {
    let scoutMarketWithJurors;
    let jurors;
    let listingId;

    beforeEach(async function () {
      const signers = await ethers.getSigners();
      // 10 dedicated juror signers, distinct from owner/seller/buyer/arbitrator/otherAccount
      jurors = signers.slice(5, 15);
      expect(jurors.length).to.equal(10);

      scoutMarketWithJurors = await ScoutMarket.deploy(
        arbitrator.address,
        jurors.map(j => j.address)
      );
      await scoutMarketWithJurors.waitForDeployment();

      await scoutMarketWithJurors.connect(seller).depositStake({ value: minSellerStake });
      const now = Math.floor(Date.now() / 1000);
      await scoutMarketWithJurors.connect(seller).createListing(
        intelHash,
        "[Health Flag] Marcus Vance — Georgia",
        intelPrice,
        now + 3600,
        0,
        now + 86400
      );
      listingId = 1;
      await scoutMarketWithJurors.connect(buyer).buyIntel(listingId, { value: intelPrice });
      await scoutMarketWithJurors.connect(seller).revealIntel(1, plaintextIntel);
      await scoutMarketWithJurors.connect(buyer).disputePurchase(1, "Claim material details missing", { value: disputeBond });
    });

    it("Registers exactly the deployed jurors and exposes them via getJurors()", async function () {
      expect(await scoutMarketWithJurors.jurorCount()).to.equal(10);
      const onChainJurors = await scoutMarketWithJurors.getJurors();
      expect(onChainJurors).to.deep.equal(jurors.map(j => j.address));
      for (const j of jurors) {
        expect(await scoutMarketWithJurors.isJuror(j.address)).to.equal(true);
      }
      expect(await scoutMarketWithJurors.isJuror(otherAccount.address)).to.equal(false);
    });

    it("Rejects votes from non-jurors", async function () {
      await expect(
        scoutMarketWithJurors.connect(otherAccount).castVote(1, true)
      ).to.be.revertedWith("Only registered committee jurors can vote");
    });

    it("Rejects a juror voting twice on the same dispute", async function () {
      await scoutMarketWithJurors.connect(jurors[0]).castVote(1, false);
      await expect(
        scoutMarketWithJurors.connect(jurors[0]).castVote(1, false)
      ).to.be.revertedWith("Juror has already voted on this dispute");
    });

    it("Resolves in the buyer's favor the instant the 3rd accept vote lands, slashing the seller", async function () {
      await scoutMarketWithJurors.connect(jurors[0]).castVote(1, true);
      await scoutMarketWithJurors.connect(jurors[1]).castVote(1, true);

      let purchase = await scoutMarketWithJurors.purchases(1);
      expect(purchase.status).to.equal(4); // still Disputed — only 2 accept votes so far

      const initialBuyerBal = await ethers.provider.getBalance(buyer.address);
      await expect(scoutMarketWithJurors.connect(jurors[2]).castVote(1, true))
        .to.emit(scoutMarketWithJurors, "DisputeResolved")
        .withArgs(1, true, "Committee ruling: accept-vote threshold reached, buyer wins.");

      purchase = await scoutMarketWithJurors.purchases(1);
      expect(purchase.status).to.equal(3); // Refunded

      const finalBuyerBal = await ethers.provider.getBalance(buyer.address);
      expect(finalBuyerBal).to.be.above(initialBuyerBal);

      const rep = await scoutMarketWithJurors.getSellerReputation(seller.address);
      expect(rep.disputesLost).to.equal(1);

      // A 4th juror trying to vote on an already-settled dispute should revert
      await expect(
        scoutMarketWithJurors.connect(jurors[3]).castVote(1, true)
      ).to.be.revertedWith("Purchase is not in disputed state");
    });

    it("Resolves in the seller's favor once accept votes can no longer reach the threshold", async function () {
      // 10 jurors, threshold 3 — once 8 have voted deny, only 2 could ever vote
      // accept, so it must resolve for the seller rather than deadlock.
      for (let i = 0; i < 8; i++) {
        await scoutMarketWithJurors.connect(jurors[i]).castVote(1, false);
      }

      const purchase = await scoutMarketWithJurors.purchases(1);
      expect(purchase.status).to.equal(2); // Confirmed (seller wins)

      const rep = await scoutMarketWithJurors.getSellerReputation(seller.address);
      expect(rep.disputesWon).to.equal(1);
    });
  });
});
