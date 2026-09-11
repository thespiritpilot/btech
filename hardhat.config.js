process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Helper to normalize private keys
function getAccounts() {
  const keys = [
    process.env.DEPLOYER_PK,
    process.env.SELLER_PK,
    process.env.BUYER_PK,
    process.env.ARBITRATOR_PK
  ].filter(Boolean).map(k => k.trim()).filter(k => k.length > 0).map(k => k.startsWith("0x") ? k : `0x${k}`);

  if (keys.length === 4) {
    return keys;
  }
  return undefined;
}

const configuredAccounts = getAccounts();

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: configuredAccounts || [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      ],
      chainId: 84532,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: configuredAccounts || [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      ],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
