process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
const BuyerAgent = require("../agents/buyer_agent");
require("dotenv").config();

async function main() {
  console.log("=======================================================================");
  console.log(` SCOUTMARKET: DISPUTE & SLASHING SIMULATION [${network.name.toUpperCase()}] `);
  console.log("=======================================================================");

  const signers = await ethers.getSigners();
  const [deployer, sellerAccount, buyerAccount, arbitratorAccount] = signers;

  const arbitratorSigner = arbitratorAccount || deployer;

  console.log(`[Role Mapping] Deployer:   ${deployer.address}`);
  console.log(`[Role Mapping] Seller:     ${sellerAccount ? sellerAccount.address : "N/A"}`);
  console.log(`[Role Mapping] Buyer:      ${buyerAccount ? buyerAccount.address : "N/A"}`);
  console.log(`[Role Mapping] Arbitrator: ${arbitratorSigner.address}`);
  console.log("-----------------------------------------------------------------------");

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
    scoutMarket = await ScoutMarketFactory.deploy(arbitratorSigner.address);
    await scoutMarket.waitForDeployment();
    contractAddress = await scoutMarket.getAddress();
  }

  const getExplorerTx = (hash) => {
    if (network.name === "sepolia") return `https://sepolia.etherscan.io/tx/${hash}`;
    if (network.name === "baseSepolia") return `https://sepolia.basescan.org/tx/${hash}`;
    return `Local Tx: ${hash}`;
  };

  const sellerAgent = new SellerAgent(sellerAccount, contractAddress, artifact.abi);
  const buyerAgent = new BuyerAgent(buyerAccount, contractAddress, artifact.abi);

  // Read before state
  const repBefore = await scoutMarket.getSellerReputation(sellerAccount.address);
  console.log("\n>>> BEFORE DISPUTE STATE:");
  console.log(`Seller Active Stake:       ${ethers.formatEther(repBefore.stake)} ETH`);
  console.log(`Seller Disputes Lost:      ${repBefore.disputesLost.toString()}`);
  console.log(`Seller Composite Score:    ${repBefore.compositeScoreBps.toString()} bps`);

  // 1. Seller stakes
  console.log("\n>>> Step 1: Ensure seller stake...");
  await sellerAgent.ensureStake("0.01");

  // 2. Seller creates listing
  console.log("\n>>> Step 2: Create listing...");
  const report = {
    teaser: "[Health Flag] Marcus Vance — Georgia",
    plaintextIntel: "DETAILED MEDICAL ALERT: Hamstring grade 2 tear detected in private workout.",
    priceEth: "0.005",
    expiryHours: 24,
    category: "Falsifiable",
    resolutionDays: 14
  };
  const listing = await sellerAgent.createScoutingListing(report);
  console.log(`[Listing Tx]: ${getExplorerTx(listing.txHash)}`);

  // 3. Buyer purchases
  console.log("\n>>> Step 3: Buyer locks escrow payment (0.005 ETH)...");
  const purchase = await buyerAgent.purchaseIntel(listing.listingId, ethers.parseEther("0.005"));
  console.log(`[Escrow Payment Tx]: ${getExplorerTx(purchase.txHash)}`);

  // 4. Seller reveals
  console.log("\n>>> Step 4: Seller reveals intel...");
  const revealTxHash = await sellerAgent.revealIntelForPurchase(purchase.purchaseId, report.plaintextIntel);
  console.log(`[Reveal Tx]: ${getExplorerTx(revealTxHash)}`);

  // 5. Buyer disputes
  console.log("\n>>> Step 5: Buyer raises dispute with bond (0.001 ETH)...");
  const disputeReason = "Delivered intel contradicts verified medical database. Material misrepresentation.";
  const disputeTxHash = await buyerAgent.raiseDispute(purchase.purchaseId, disputeReason, "0.001");
  console.log(`[Dispute Raised Tx]: ${getExplorerTx(disputeTxHash)}`);

  // 6. Arbitrator resolves
  console.log("\n>>> Step 6: Arbitrator resolves dispute in favor of buyer...");
  const resolveTx = await scoutMarket.connect(arbitratorSigner).resolveDispute(
    purchase.purchaseId,
    true, // buyerWins
    "Arbitration Ruling: Seller delivered false intel. Stake slashed 0.005 ETH, full refund + compensation awarded to buyer."
  );
  await resolveTx.wait();
  console.log(`[Arbitration Resolution Tx]: ${getExplorerTx(resolveTx.hash)}`);

  // Read after state
  const repAfter = await scoutMarket.getSellerReputation(sellerAccount.address);

  console.log("\n=======================================================================");
  console.log("            DISPUTE RESOLUTION & SLASHING SUMMARY                     ");
  console.log("=======================================================================");
  console.log(`Seller Stake Before:       ${ethers.formatEther(repBefore.stake)} ETH`);
  console.log(`Seller Stake After Slash:  ${ethers.formatEther(repAfter.stake)} ETH`);
  console.log(`Seller Disputes Lost:      ${repAfter.disputesLost.toString()}`);
  console.log(`Seller Composite Score:    ${repAfter.compositeScoreBps.toString()} bps`);
  console.log(`1. Listing Created Tx:     ${getExplorerTx(listing.txHash)}`);
  console.log(`2. Escrow Payment Tx:      ${getExplorerTx(purchase.txHash)}`);
  console.log(`3. Proof of Reveal Tx:     ${getExplorerTx(revealTxHash)}`);
  console.log(`4. Dispute Filed Tx:       ${getExplorerTx(disputeTxHash)}`);
  console.log(`5. Arbitrator Ruling Tx:   ${getExplorerTx(resolveTx.hash)}`);
  console.log("=======================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
