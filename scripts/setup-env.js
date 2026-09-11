const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env");

if (!fs.existsSync(envPath)) {
  console.log("Generating dedicated keypairs for Base Sepolia testnet accounts...");
  const deployer = ethers.Wallet.createRandom();
  const seller = ethers.Wallet.createRandom();
  const buyer = ethers.Wallet.createRandom();
  const arbitrator = ethers.Wallet.createRandom();

  const envContent = `# ScoutMarket Testnet Configuration
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASESCAN_API_KEY=

# Dedicated Role Accounts
DEPLOYER_PK=${deployer.privateKey}
SELLER_PK=${seller.privateKey}
BUYER_PK=${buyer.privateKey}
ARBITRATOR_PK=${arbitrator.privateKey}
`;

  fs.writeFileSync(envPath, envContent);
  console.log("Created .env with dedicated keypairs.");
} else {
  console.log(".env already exists.");
}
