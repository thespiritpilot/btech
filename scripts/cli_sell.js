process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const SellerAgent = require("../agents/seller_agent");
require("dotenv").config();

// Terminal-only "sell" action against the live deployed contract.
// Usage:
//   npm run sell
//   TEASER="[Health Flag] Name — Team" INTEL="..." PRICE_ETH=0.002 npm run sell

async function main() {
  const [, sellerAccount] = await ethers.getSigners();
  if (!sellerAccount) throw new Error("SELLER_PK not configured in .env");

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const { contractAddress } = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");

  const sellerAgent = new SellerAgent(sellerAccount, contractAddress, artifact.abi);
  await sellerAgent.ensureStake("0.01");

  const teaser = process.env.TEASER || "[Young Star] Marcus Vance — Georgia";
  const plaintextIntel = process.env.INTEL ||
    "PROSPECT REPORT: Marcus Vance (Georgia WR) — 4.41s verified 40-yard dash, elite route-running precision.";
  const priceEth = process.env.PRICE_ETH || "0.002";

  const listing = await sellerAgent.createScoutingListing({
    teaser,
    plaintextIntel,
    priceEth,
    expiryHours: 72,
    category: "Falsifiable",
    resolutionDays: 30
  });

  console.log(`\n✅ Listing #${listing.listingId} created: "${teaser}" for ${priceEth} ETH`);
  console.log(`Tx: https://sepolia.etherscan.io/tx/${listing.txHash}`);
  console.log(`\nBuy it with:  LISTING_ID=${listing.listingId} npm run buy`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
