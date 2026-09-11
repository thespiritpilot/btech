process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
const BuyerAgent = require("../agents/buyer_agent");
require("dotenv").config();

async function main() {
  console.log("=======================================================================");
  console.log("  LIVE INTERACTIVE FLOW TEST ON SEPOLIA: SELL -> BUY -> REVEAL -> CONFIRM");
  console.log("=======================================================================");

  const signers = await ethers.getSigners();
  const [deployer, sellerAccount, buyerAccount] = signers;

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");
  const scoutMarket = new ethers.Contract(contractAddress, artifact.abi, deployer);

  const sellerAgent = new SellerAgent(sellerAccount, contractAddress, artifact.abi);
  const buyerAgent = new BuyerAgent(buyerAccount, contractAddress, artifact.abi);

  // 1. SELL FLOW
  console.log("\n>>> [SELL FLOW] Seller creates listing [Young Star] Devin Brooks — Alabama...");
  const intelPackage = {
    categoryTag: "Young Star",
    playerName: "Devin Brooks",
    team: "Alabama",
    plaintextIntel: "PROSPECT SCOUTING REPORT: Devin Brooks (Alabama CB) - Verified 4.34s 40-yd dash in private workout. Elite hip fluidity, projected Top-15 draft lock.",
    priceEth: "0.002",
    expiryHours: 72,
    category: "Falsifiable",
    resolutionDays: 30
  };

  const sellResult = await sellerAgent.createScoutingListing(intelPackage);
  console.log(`Sell Tx Hash: https://sepolia.etherscan.io/tx/${sellResult.txHash}`);
  console.log(`Listing ID:   #${sellResult.listingId}`);

  // 2. BUY FLOW
  console.log(`\n>>> [BUY FLOW] Buyer locks escrow for listing #${sellResult.listingId}...`);
  const buyResult = await buyerAgent.purchaseIntel(sellResult.listingId, ethers.parseEther("0.002"));
  console.log(`Buy Tx Hash:  https://sepolia.etherscan.io/tx/${buyResult.txHash}`);
  console.log(`Purchase ID:  #${buyResult.purchaseId}`);

  // 3. REVEAL FLOW
  console.log("\n>>> [REVEAL FLOW] Seller reveals plaintext intel on-chain...");
  const revealTxHash = await sellerAgent.revealIntelForPurchase(buyResult.purchaseId, intelPackage.plaintextIntel);
  console.log(`Reveal Tx:    https://sepolia.etherscan.io/tx/${revealTxHash}`);

  // 4. CONFIRM FLOW
  console.log("\n>>> [CONFIRM FLOW] Buyer verifies commitment hash and releases funds...");
  const confirmResult = await buyerAgent.verifyAndConfirm(buyResult.purchaseId, sellResult.commitmentHash);
  console.log(`Confirm Tx:   https://sepolia.etherscan.io/tx/${confirmResult.txHash}`);

  console.log("\n=======================================================================");
  console.log("                 INTERACTIVE FLOW TEST SUMMARY                         ");
  console.log("=======================================================================");
  console.log(`1. Sell Listing:   https://sepolia.etherscan.io/tx/${sellResult.txHash}`);
  console.log(`2. Buy Escrow:     https://sepolia.etherscan.io/tx/${buyResult.txHash}`);
  console.log(`3. Reveal Intel:   https://sepolia.etherscan.io/tx/${revealTxHash}`);
  console.log(`4. Confirm Payout: https://sepolia.etherscan.io/tx/${confirmResult.txHash}`);
  console.log("=======================================================================\n");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

