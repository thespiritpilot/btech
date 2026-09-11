const { expect } = require("chai");
const { ethers } = require("hardhat");
const EthCrypto = require("eth-crypto");

describe("ScoutMarketEncrypted (prototype) Unit Tests", function () {
  let contract, deployer, seller, arbitrator, stranger;
  let buyerWallet, buyerIdentity;
  let jurorSigners;

  const minSellerStake = ethers.parseEther("0.01");
  const disputeBond = ethers.parseEther("0.001");
  const price = ethers.parseEther("0.002");
  const plaintext = "Grade-2 hamstring strain, re-injury risk within 8 weeks.";
  const commitment = ethers.keccak256(ethers.toUtf8Bytes(plaintext));

  async function freshListing() {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600;
    await contract.connect(seller).depositStake({ value: minSellerStake });
    await contract.connect(seller).createListing(commitment, "[Health Flag] Marcus Vance — Georgia", price, expiry, 0, expiry);
    await contract.connect(buyerWallet).buyIntel(1, { value: price });
  }

  async function encryptFor(publicKey, text) {
    const obj = await EthCrypto.encryptWithPublicKey(publicKey, text);
    return ethers.hexlify(ethers.toUtf8Bytes(EthCrypto.cipher.stringify(obj)));
  }

  function decryptBytes(privateKey, onChainBytes) {
    const obj = EthCrypto.cipher.parse(ethers.toUtf8String(onChainBytes));
    return EthCrypto.decryptWithPrivateKey(privateKey, obj);
  }

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [deployer, seller, arbitrator, stranger] = signers;
    jurorSigners = signers.slice(4, 4 + 10); // up to 10 more accounts as jurors

    buyerIdentity = EthCrypto.createIdentity();
    buyerWallet = new ethers.Wallet(buyerIdentity.privateKey, ethers.provider);
    await deployer.sendTransaction({ to: buyerWallet.address, value: ethers.parseEther("2") });

    const Factory = await ethers.getContractFactory("ScoutMarketEncrypted");
    contract = await Factory.deploy(arbitrator.address, jurorSigners.map((j) => j.address));
    await contract.waitForDeployment();
  });

  describe("Happy path", function () {
    it("lets the real buyer decrypt and confirm, and pays the seller", async function () {
      await freshListing();

      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await contract.connect(seller).revealIntel(1, ciphertext);

      const purchase = await contract.purchases(1);
      expect(purchase.status).to.equal(1); // Revealed

      const recovered = await decryptBytes(buyerIdentity.privateKey, purchase.encryptedContent);
      expect(recovered).to.equal(plaintext);
      expect(ethers.keccak256(ethers.toUtf8Bytes(recovered))).to.equal(commitment);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      await contract.connect(buyerWallet).confirmReceipt(1);
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

      expect((await contract.purchases(1)).status).to.equal(2); // Confirmed
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(price);
    });

    it("stores ciphertext that is NOT human-readable to anyone watching the chain", async function () {
      await freshListing();
      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await contract.connect(seller).revealIntel(1, ciphertext);

      const purchase = await contract.purchases(1);
      let leaked = false;
      try {
        const asText = ethers.toUtf8String(purchase.encryptedContent);
        if (asText.toLowerCase().includes("hamstring")) leaked = true;
      } catch (_) { /* not even parseable as the plaintext — expected */ }
      expect(leaked).to.equal(false);
    });
  });

  describe("Only the real buyer's key can decrypt it", function () {
    it("fails to decrypt (or produces garbage) with a different party's private key", async function () {
      await freshListing();
      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await contract.connect(seller).revealIntel(1, ciphertext);

      const purchase = await contract.purchases(1);
      const impostorIdentity = EthCrypto.createIdentity(); // not the buyer

      let decryptedForImpostor = null;
      let threw = false;
      try {
        decryptedForImpostor = await decryptBytes(impostorIdentity.privateKey, purchase.encryptedContent);
      } catch (_) {
        threw = true; // ECIES correctly refuses — this is the expected, desired outcome
      }
      expect(threw || decryptedForImpostor !== plaintext).to.equal(true);
    });
  });

  describe("Dispute path now carries the verification the contract can no longer do", function () {
    it("lets the buyer dispute a mismatched reveal, and the arbitrator catches it by re-hashing the disclosed plaintext", async function () {
      await freshListing();

      // Seller cheats: encrypts something DIFFERENT from what was committed to.
      const dishonestText = "Fully healthy, no injury concerns at all.";
      const ciphertext = await encryptFor(buyerIdentity.publicKey, dishonestText);
      await contract.connect(seller).revealIntel(1, ciphertext);

      // The contract has no way to catch this itself now — it accepted the reveal.
      expect((await contract.purchases(1)).status).to.equal(1); // Revealed, even though it's dishonest

      // Buyer decrypts, notices the mismatch against the public commitment themselves.
      const purchase = await contract.purchases(1);
      const recovered = await decryptBytes(buyerIdentity.privateKey, purchase.encryptedContent);
      const listing = await contract.listings(1);
      const mismatch = ethers.keccak256(ethers.toUtf8Bytes(recovered)) !== listing.contentCommitment;
      expect(mismatch).to.equal(true);

      // Buyer disputes, disclosing the decrypted plaintext so the arbitrator can check it.
      await contract.connect(buyerWallet).disputePurchase(1, recovered, { value: disputeBond });
      expect((await contract.purchases(1)).status).to.equal(4); // Disputed

      // Arbitrator independently re-hashes the disclosed text against the original commitment.
      const disputeReason = (await contract.purchases(1)).disputeReason;
      const arbitratorSeesMismatch = ethers.keccak256(ethers.toUtf8Bytes(disputeReason)) !== listing.contentCommitment;
      expect(arbitratorSeesMismatch).to.equal(true);

      const buyerBalanceBefore = await ethers.provider.getBalance(buyerWallet.address);
      const tx = await contract.connect(arbitrator).resolveDispute(1, true, "Hash mismatch confirmed against original commitment.");
      await tx.wait();
      const buyerBalanceAfter = await ethers.provider.getBalance(buyerWallet.address);

      expect((await contract.purchases(1)).status).to.equal(3); // Refunded
      // Buyer gets escrow + bond + slashed seller stake back.
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(price + disputeBond + ethers.parseEther("0.005"));

      const sellerRep = await contract.sellerReputations(seller.address);
      expect(sellerRep.disputesLost).to.equal(1n);
      expect(sellerRep.stake).to.equal(minSellerStake - ethers.parseEther("0.005"));
    });
  });

  describe("Juror committee — never sees content unless a dispute discloses it", function () {
    it("registers the deployed jurors via getJurors()", async function () {
      const registered = await contract.getJurors();
      expect(registered.length).to.equal(10);
      expect(await contract.jurorCount()).to.equal(10n);
    });

    it("resolves in the buyer's favor the instant the 3rd accept vote lands, having judged only the disclosed plaintext", async function () {
      await freshListing();

      // Seller cheats — encrypts different content than what was committed to.
      const dishonestText = "Fully healthy, no injury concerns at all.";
      const ciphertext = await encryptFor(buyerIdentity.publicKey, dishonestText);
      await contract.connect(seller).revealIntel(1, ciphertext);

      // Buyer decrypts privately, finds the mismatch, discloses it in the dispute.
      const purchase = await contract.purchases(1);
      const recovered = await decryptBytes(buyerIdentity.privateKey, purchase.encryptedContent);
      await contract.connect(buyerWallet).disputePurchase(1, recovered, { value: disputeBond });

      // Jurors read that disclosed plaintext (disputeReason) and vote — same evidence an
      // arbitrator would use, never anything decrypted or provided off-chain to them.
      const listing = await contract.listings(1);
      for (let i = 0; i < 3; i++) {
        const disputeReason = (await contract.purchases(1)).disputeReason;
        const shouldAccept = ethers.keccak256(ethers.toUtf8Bytes(disputeReason)) !== listing.contentCommitment;
        await contract.connect(jurorSigners[i]).castVote(1, shouldAccept);
      }

      expect((await contract.purchases(1)).status).to.equal(3); // Refunded
      const sellerRep = await contract.sellerReputations(seller.address);
      expect(sellerRep.disputesLost).to.equal(1n);
    });

    it("resolves in the seller's favor once accept votes can no longer reach the threshold", async function () {
      await freshListing();

      // Seller is honest this time — an over-cautious buyer disputes anyway.
      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await contract.connect(seller).revealIntel(1, ciphertext);
      await contract.connect(buyerWallet).disputePurchase(1, plaintext, { value: disputeBond });

      // 8 denies makes the 3-accept threshold mathematically unreachable (10 - 8 = 2 < 3).
      for (let i = 0; i < 8; i++) {
        await contract.connect(jurorSigners[i]).castVote(1, false);
      }

      expect((await contract.purchases(1)).status).to.equal(2); // Confirmed — seller wins
      const sellerRep = await contract.sellerReputations(seller.address);
      expect(sellerRep.disputesWon).to.equal(1n);
    });

    it("rejects votes from non-jurors and double votes from the same juror", async function () {
      await freshListing();
      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await contract.connect(seller).revealIntel(1, ciphertext);
      await contract.connect(buyerWallet).disputePurchase(1, plaintext, { value: disputeBond });

      await expect(contract.connect(stranger).castVote(1, true)).to.be.revertedWith("Only registered committee jurors can vote");

      await contract.connect(jurorSigners[0]).castVote(1, true);
      await expect(contract.connect(jurorSigners[0]).castVote(1, true)).to.be.revertedWith("Juror has already voted on this dispute");
    });
  });

  describe("Guardrails carried over from ScoutMarket.sol", function () {
    it("rejects an empty ciphertext reveal", async function () {
      await freshListing();
      await expect(contract.connect(seller).revealIntel(1, "0x")).to.be.revertedWith("Ciphertext cannot be empty");
    });

    it("rejects reveal from anyone but the listing's seller", async function () {
      await freshListing();
      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await expect(contract.connect(stranger).revealIntel(1, ciphertext)).to.be.revertedWith("Only seller can reveal intel");
    });

    it("rejects confirmReceipt from anyone but the purchase's buyer", async function () {
      await freshListing();
      const ciphertext = await encryptFor(buyerIdentity.publicKey, plaintext);
      await contract.connect(seller).revealIntel(1, ciphertext);
      await expect(contract.connect(stranger).confirmReceipt(1)).to.be.revertedWith("Only buyer can confirm receipt");
    });
  });
});
