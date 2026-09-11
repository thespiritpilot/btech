process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
const BuyerAgent = require("../agents/buyer_agent");
require("dotenv").config();

async function main() {
  console.log("=======================================================================");
  console.log(` SCOUTMARKET: LIVE FALSIFIABLE CLAIM RESOLUTION DEMO [${network.name.toUpperCase()}] `);
  console.log("=======================================================================");

  const signers = await ethers.getSigners();
  const [deployer, sellerAccount, buyerAccount, arbitratorAccount] = signers;

  const arbitratorSigner = arbitratorAccount || deployer;
  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log(`Contract:                  ${contractAddress}`);
  console.log(`Seller:                    ${sellerAccount.address}`);
  console.log(`Arbitrator:                ${arbitratorSigner.address}`);
  console.log("-----------------------------------------------------------------------");

  const scoutMarket = new ethers.Contract(contractAddress, artifact.abi, deployer);
  const sellerAgent = new SellerAgent(sellerAccount, contractAddress, artifact.abi);
  const buyerAgent = new BuyerAgent(buyerAccount, contractAddress, artifact.abi);

  // Read Reputation Before Resolution
  const repBefore = await scoutMarket.getSellerReputation(sellerAccount.address);
  console.log("\n>>> BEFORE RESOLUTION STATE:");
  console.log(`Completed Sales:           ${repBefore.completedSales.toString()}`);
  console.log(`Resolved Claims:           ${repBefore.resolvedClaims.toString()}`);
  console.log(`Accurate Claims:           ${repBefore.accurateClaims.toString()}`);
  console.log(`Composite Score:           ${repBefore.compositeScoreBps.toString()} bps`);

  // Ensure seller stake meets minimum (after previous slash)
  console.log("\n>>> Step 0: Ensure seller stake is topped up to 0.01 ETH...");
  await sellerAgent.ensureStake("0.01");

  // Step 1: Create a listing with resolution timestamp 60 seconds in future
  console.log("\n>>> Step 1: Seller creates listing with resolution date (60s in future)...");
  const plaintextIntel = "CONFIDENTIAL DRAFT INTEL: Player Marcus Vance will be drafted in Round 2 (verified scouting board).";
  const commitmentHash = ethers.keccak256(ethers.toUtf8Bytes(plaintextIntel));
  
  const currentBlock = await ethers.provider.getBlock("latest");
  const now = currentBlock.timestamp;
  const expiryTimestamp = now + 3600; // 1 hour expiry
  const claimResolutionTimestamp = now + 60; // 60 seconds in future

  const createTx = await scoutMarket.connect(sellerAccount).createListing(
    commitmentHash,
    `Round 2 Draft Pick Prediction - Vance (Live Resolution Demo #${Date.now().toString().slice(-4)})`,
    ethers.parseEther("0.002"),
    expiryTimestamp,
    0, // Category: Falsifiable
    claimResolutionTimestamp
  );
  const createReceipt = await createTx.wait();
  console.log(`Listing Created Tx:        https://sepolia.etherscan.io/tx/${createTx.hash}`);

  let listingId = 3;
  for (const log of createReceipt.logs) {
    try {
      const parsed = scoutMarket.interface.parseLog(log);
      if (parsed && parsed.name === "ListingCreated") {
        listingId = parsed.args.listingId;
        break;
      }
    } catch (e) {}
  }
  console.log(`Listing ID:                #${listingId}`);

  // Step 2: Buyer purchases and Seller reveals (Happy path)
  console.log("\n>>> Step 2: Buyer purchases and seller reveals intel...");
  const buyTx = await scoutMarket.connect(buyerAccount).buyIntel(listingId, { value: ethers.parseEther("0.002") });
  const buyReceipt = await buyTx.wait();
  console.log(`Escrow Purchase Tx:        https://sepolia.etherscan.io/tx/${buyTx.hash}`);

  let purchaseId = 3;
  for (const log of buyReceipt.logs) {
    try {
      const parsed = scoutMarket.interface.parseLog(log);
      if (parsed && parsed.name === "IntelPurchased") {
        purchaseId = parsed.args.purchaseId;
        break;
      }
    } catch (e) {}
  }

  const revealTx = await scoutMarket.connect(sellerAccount).revealIntel(purchaseId, plaintextIntel);
  await revealTx.wait();
  console.log(`Proof of Reveal Tx:        https://sepolia.etherscan.io/tx/${revealTx.hash}`);

  const confirmTx = await scoutMarket.connect(buyerAccount).confirmReceipt(purchaseId);
  await confirmTx.wait();
  console.log(`Receipt Confirmed Tx:      https://sepolia.etherscan.io/tx/${confirmTx.hash}`);

  // Step 3: Resolution Date Reached -> Arbitrator resolves claim outcome as accurate (true)
  console.log("\n>>> Step 3: Waiting for resolution timestamp to pass on-chain...");
  while (true) {
    const b = await ethers.provider.getBlock("latest");
    if (b.timestamp >= claimResolutionTimestamp) {
      console.log(`Current block timestamp (${b.timestamp}) >= resolution timestamp (${claimResolutionTimestamp}). Proceeding!`);
      break;
    }
    const remaining = claimResolutionTimestamp - b.timestamp;
    console.log(`Waiting ${remaining}s for resolution timestamp...`);
    await new Promise(r => setTimeout(r, 6000));
  }

  console.log("Arbitrator submitting resolveFalsifiableClaim(listingId, true)...");
  const resolveClaimTx = await scoutMarket.connect(arbitratorSigner).resolveFalsifiableClaim(
    listingId,
    true // claimWasAccurate = true
  );
  await resolveClaimTx.wait();
  console.log(`Claim Resolution Tx:       https://sepolia.etherscan.io/tx/${resolveClaimTx.hash}`);

  // Step 4: Read Reputation After Resolution
  const repAfter = await scoutMarket.getSellerReputation(sellerAccount.address);
  console.log("\n=======================================================================");
  console.log("               FALSIFIABLE CLAIM RESOLUTION AUDIT                      ");
  console.log("=======================================================================");
  console.log(`Resolved Claims:           ${repAfter.resolvedClaims.toString()} (Increased from ${repBefore.resolvedClaims})`);
  console.log(`Accurate Claims:           ${repAfter.accurateClaims.toString()} (Increased from ${repBefore.accurateClaims})`);
  console.log(`Composite Reputation:      ${repAfter.compositeScoreBps.toString()} bps (Updated from ${repBefore.compositeScoreBps} bps)`);
  console.log(`1. Listing Created Tx:     https://sepolia.etherscan.io/tx/${createTx.hash}`);
  console.log(`2. Escrow Payment Tx:      https://sepolia.etherscan.io/tx/${buyTx.hash}`);
  console.log(`3. Proof of Reveal Tx:     https://sepolia.etherscan.io/tx/${revealTx.hash}`);
  console.log(`4. Receipt Confirmed Tx:   https://sepolia.etherscan.io/tx/${confirmTx.hash}`);
  console.log(`5. Claim Resolution Tx:    https://sepolia.etherscan.io/tx/${resolveClaimTx.hash}`);
  console.log("=======================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
