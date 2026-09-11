const express = require("express");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();
app.use(express.json());

function getDeploymentInfo() {
  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  if (fs.existsSync(deployPath)) {
    try {
      return JSON.parse(fs.readFileSync(deployPath, "utf8"));
    } catch (e) {
      console.error("Error reading deployed_addresses.json", e);
    }
  }
  return {
    contractAddress: process.env.SCOUT_MARKET_ADDRESS || null,
    network: process.env.NETWORK || "unknown"
  };
}

// In-memory store for seller intel packages (off-chain storage)
const intelStore = {
  "1": {
    listingId: 1,
    teaser: "3rd-round WR Prospect Soft-Tissue Injury Warning",
    price: "5000000000000000", // 0.005 ETH
    commitment: "0xb7e9802d4e0ef0556408a2e6d37287b6fa8c3d95303e9d7f7699cec9fa4908bd",
    category: "Falsifiable",
    plaintext: "PROSPECT REPORT #84: WR Marcus Vance - High hamstring tendonitis risk. Medical red flag raised by Dr. Cole.",
    sellerAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }
};

// GET /api/intel/latest - Public discovery endpoint
app.get("/api/intel/latest", (req, res) => {
  const deploymentInfo = getDeploymentInfo();
  const teasers = Object.values(intelStore).map(item => ({
    listingId: item.listingId,
    teaser: item.teaser,
    price: item.price,
    category: item.category,
    contract: deploymentInfo.contractAddress
  }));
  res.json({ status: "success", count: teasers.length, listings: teasers, contractAddress: deploymentInfo.contractAddress });
});

// GET /api/intel/:id - x402 Payment Required endpoint
app.get("/api/intel/:id", (req, res) => {
  const deploymentInfo = getDeploymentInfo();
  const item = intelStore[req.params.id];
  if (!item) {
    return res.status(404).json({ error: "Intel listing not found" });
  }

  // HTTP 402 Payment Required protocol response
  res.status(402).json({
    status: 402,
    error: "Payment Required",
    protocol: "x402-sports-scout",
    message: "Pre-payment inspection disallowed to protect unverifiable intelligence value. Pay via smart contract escrow to trigger proof-of-reveal.",
    listingId: item.listingId,
    contractAddress: deploymentInfo.contractAddress,
    priceWei: item.price,
    priceEth: ethers.formatEther(item.price),
    teaser: item.teaser,
    commitmentHash: item.commitment,
    escrowInstructions: {
      step1: "Read seller reputation & stake on-chain using getSellerReputation(sellerAddress)",
      step2: "Call buyIntel(listingId) on ScoutMarket contract with value = priceWei",
      step3: "Seller agent will detect on-chain purchase and invoke revealIntel(purchaseId, plaintext)",
      step4: "Contract automatically verifies keccak256(plaintext) == commitmentHash"
    }
  });
});

const PORT = process.env.PORT || 4020;
if (require.main === module) {
  const deploymentInfo = getDeploymentInfo();
  app.listen(PORT, () => {
    console.log(`[x402 Server] Sports Scouting Intel x402 Server active on port ${PORT}`);
    console.log(`[x402 Server] Live Contract: ${deploymentInfo.contractAddress || "Not deployed yet (set in deployed_addresses.json or SCOUT_MARKET_ADDRESS)"}`);
    console.log(`[x402 Server] Network: ${deploymentInfo.network || "hardhat"}`);
  });
}

module.exports = { app, intelStore, getDeploymentInfo };
