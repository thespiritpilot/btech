process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
require("dotenv").config();

// Long-running "autonomous seller" process: watches on-chain purchases against
// listings created by SELLER_PK (via agents/seller_agent.js createScoutingListing,
// which caches plaintext into agents/.keystore.json) and reveals them automatically
// within one poll cycle of the buy transaction confirming — no manual step needed.
//
// Usage: npm run watch:seller   (defaults to --network sepolia)

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, sellerAccount] = signers;
  const seller = sellerAccount || deployer;

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");
  const sellerAgent = new SellerAgent(seller, contractAddress, artifact.abi);

  console.log("=======================================================================");
  console.log("  SELLER WATCHER: auto-reveals purchases against your listings on sight");
  console.log("=======================================================================");
  console.log(`Contract: ${contractAddress}`);
  console.log(`Seller:   ${seller.address}`);
  console.log("Press Ctrl+C to stop.\n");

  const stop = sellerAgent.watchAndAutoReveal({ pollIntervalMs: 10_000 });

  process.on("SIGINT", () => {
    console.log("\n[Seller Watcher] Stopping...");
    stop();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
