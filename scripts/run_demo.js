process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
const BuyerAgent = require("../agents/buyer_agent");
require("dotenv").config();

async function main() {
  console.log("=======================================================================");
  console.log(` SCOUTMARKET: ON-CHAIN SPORTS INTELLIGENCE DEMO LOOP [${network.name.toUpperCase()}] `);
  console.log("=======================================================================");

  const signers = await ethers.getSigners();
  const [deployer, sellerAccount, buyerAccount, arbitratorAccount] = signers;

  console.log(`[Role Mapping] Deployer:   ${deployer.address}`);
  console.log(`[Role Mapping] Seller:     ${sellerAccount ? sellerAccount.address : "N/A"}`);
  console.log(`[Role Mapping] Buyer:      ${buyerAccount ? buyerAccount.address : "N/A"}`);
  console.log(`[Role Mapping] Arbitrator: ${arbitratorAccount ? arbitratorAccount.address : "N/A"}`);
  console.log("-----------------------------------------------------------------------");

  if (!sellerAccount || !buyerAccount) {
    throw new Error("Missing seller or buyer account configuration. Ensure DEPLOYER_PK, SELLER_PK, BUYER_PK, ARBITRATOR_PK are defined in .env");
  }

  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");
  let contractAddress;
  let scoutMarket;

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  if (network.name !== "hardhat" && fs.existsSync(deployPath)) {
    const deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));
    if (deploymentInfo.contractAddress) {
      contractAddress = deploymentInfo.contractAddress;
      scoutMarket = new ethers.Contract(contractAddress, artifact.abi, deployer);
      console.log(`>>> Reusing existing deployment at: ${contractAddress}`);
    }
  }

  if (!scoutMarket) {
    console.log("\n>>> Deploying fresh ScoutMarket Smart Contract...");
    const ScoutMarketFactory = await ethers.getContractFactory("ScoutMarket", deployer);
    scoutMarket = await ScoutMarketFactory.deploy(arbitratorAccount ? arbitratorAccount.address : deployer.address, []);
    await scoutMarket.waitForDeployment();
    contractAddress = await scoutMarket.getAddress();
    console.log(`[Success] Deployed to: ${contractAddress}`);
  }

  const getExplorerTx = (hash) => {
    if (network.name === "sepolia") return `https://sepolia.etherscan.io/tx/${hash}`;
    if (network.name === "baseSepolia") return `https://sepolia.basescan.org/tx/${hash}`;
    return `Local Tx: ${hash}`;
  };

  // Instantiate Agents
  const sellerAgent = new SellerAgent(sellerAccount, contractAddress, artifact.abi);
  const buyerAgent = new BuyerAgent(buyerAccount, contractAddress, artifact.abi);

  // Step 1: Seller Staking
  console.log("\n>>> STEP 1: Seller Staking (Skin in the Game)...");
  await sellerAgent.ensureStake("0.01");

  // Step 2: Listing Creation
  console.log("\n>>> STEP 2: Seller Packages Scouting Intel & Posts Commitment...");
  const scoutingReport = {
    teaser: "[Health Flag] Jaylen Cole — Oregon",
    plaintextIntel: "CONFIDENTIAL SCOUT REPORT #904: Film study across 6 games indicates 14% drop in ball velocity past 40 yards in 4th quarters. Medical red flag flag by Dr. Cole. High risk for late Round 1.",
    priceEth: "0.005",
    expiryHours: 24,
    category: "Falsifiable",
    resolutionDays: 30
  };

  const listingResult = await sellerAgent.createScoutingListing(scoutingReport);
  console.log(`[Listing Tx]: ${getExplorerTx(listingResult.txHash)}`);

  // Step 3: Buyer Evaluation & Decision
  console.log("\n>>> STEP 3: Buyer Agent Evaluates Reputation On-Chain...");
  const evaluation = await buyerAgent.evaluateListing(listingResult.listingId);
  if (!evaluation.shouldBuy) {
    throw new Error(`Buyer rejected purchase: ${evaluation.reason}`);
  }

  // Step 4: Escrow Purchase
  console.log("\n>>> STEP 4: Buyer Agent Locks Payment into Escrow...");
  const purchaseResult = await buyerAgent.purchaseIntel(listingResult.listingId, evaluation.price);
  console.log(`[Escrow Payment Tx]: ${getExplorerTx(purchaseResult.txHash)}`);

  // Step 5: Seller Proof of Reveal
  console.log("\n>>> STEP 5: Seller Submits Proof of Reveal On-Chain...");
  const revealTxHash = await sellerAgent.revealIntelForPurchase(purchaseResult.purchaseId, scoutingReport.plaintextIntel);
  console.log(`[Proof of Reveal Tx]: ${getExplorerTx(revealTxHash)}`);

  // Step 6: Buyer Verification & Confirmation
  console.log("\n>>> STEP 6: Buyer Verifies Hash Commitment & Releases Escrow...");
  const verification = await buyerAgent.verifyAndConfirm(purchaseResult.purchaseId, listingResult.commitmentHash);
  console.log(`[Confirmation & Payout Tx]: ${getExplorerTx(verification.txHash)}`);

  const repAfter = await scoutMarket.getSellerReputation(sellerAccount.address);

  console.log("\n=======================================================================");
  console.log("                 LIVE DEMO TRANSACTION SUMMARY                         ");
  console.log("=======================================================================");
  console.log(`Contract:                  ${contractAddress}`);
  console.log(`Seller Completed Sales:    ${repAfter.completedSales.toString()}`);
  console.log(`Seller Total Earnings:     ${ethers.formatEther(repAfter.totalEarnings)} ETH`);
  console.log(`Seller Active Stake:       ${ethers.formatEther(repAfter.stake)} ETH`);
  console.log(`Seller Composite Score:    ${repAfter.compositeScoreBps.toString()} bps`);
  console.log(`1. Listing Created:        ${getExplorerTx(listingResult.txHash)}`);
  console.log(`2. Escrow Payment:         ${getExplorerTx(purchaseResult.txHash)}`);
  console.log(`3. Proof of Reveal:        ${getExplorerTx(revealTxHash)}`);
  console.log(`4. Receipt Confirmed:      ${getExplorerTx(verification.txHash)}`);
  console.log("=======================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
