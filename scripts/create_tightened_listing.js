process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
require("dotenv").config();

async function main() {
  console.log(`>>> Creating fresh on-chain listing on ${network.name} with tightened teaser format...`);
  const signers = await ethers.getSigners();
  const [deployer, sellerAccount] = signers;

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");
  const sellerAgent = new SellerAgent(sellerAccount, contractAddress, artifact.abi);

  await sellerAgent.ensureStake("0.01");

  const intelPackage = {
    categoryTag: "Health Flag",
    playerName: "Jaylen Cole",
    team: "Oregon",
    plaintextIntel: "CONFIDENTIAL MEDICAL REPORT: Jaylen Cole (Oregon QB) - Subscapularis tendon strain flagged on pre-draft physical. High re-injury risk if rushed.",
    priceEth: "0.003",
    expiryHours: 72,
    category: "Falsifiable",
    resolutionDays: 60
  };

  const result = await sellerAgent.createScoutingListing(intelPackage);
  console.log("\n=======================================================================");
  console.log("            NEW TIGHTENED TEASER LISTING CREATED                       ");
  console.log("=======================================================================");
  console.log(`Listing ID: #${result.listingId}`);
  console.log(`Teaser:     ${result.teaser}`);
  console.log(`Tx Hash:    https://sepolia.etherscan.io/tx/${result.txHash}`);
  console.log("=======================================================================\n");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
