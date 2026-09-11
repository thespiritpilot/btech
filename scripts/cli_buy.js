process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const BuyerAgent = require("../agents/buyer_agent");
require("dotenv").config();

// Terminal-only "buy" action against the live deployed contract.
// Usage:
//   npm run buy                    (buys the most recently created listing)
//   LISTING_ID=8 npm run buy       (buys a specific listing)

async function main() {
  const [, , buyerAccount] = await ethers.getSigners();
  if (!buyerAccount) throw new Error("BUYER_PK not configured in .env");

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const { contractAddress } = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");
  const contract = new ethers.Contract(contractAddress, artifact.abi, buyerAccount);

  let listingId = process.env.LISTING_ID ? Number(process.env.LISTING_ID) : null;
  if (!listingId) {
    listingId = Number(await contract.listingCounter());
    console.log(`No LISTING_ID given — defaulting to the most recent listing (#${listingId}).`);
  }

  const listing = await contract.listings(listingId);
  if (listing.listingId.toString() === "0") {
    throw new Error(`Listing #${listingId} does not exist.`);
  }
  if (!listing.active) {
    throw new Error(`Listing #${listingId} is not active.`);
  }

  const buyerAgent = new BuyerAgent(buyerAccount, contractAddress, artifact.abi);
  const result = await buyerAgent.purchaseIntel(listingId, listing.price);

  console.log(`\n✅ Purchase #${result.purchaseId} created on Listing #${listingId} ("${listing.teaser}").`);
  console.log(`Tx: https://sepolia.etherscan.io/tx/${result.txHash}`);
  console.log(`\nHave the seller reveal it, then dispute it with:  PURCHASE_ID=${result.purchaseId} npm run dispute`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
