process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("ethers");
require("dotenv").config();

async function testRpc() {
  const urls = [
    "https://sepolia.base.org",
    "https://base-sepolia.blockpi.network/v1/rpc/public",
    "https://1rpc.io/base-sepolia",
    "https://base-sepolia-rpc.publicnode.com"
  ];

  for (const url of urls) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      const network = await provider.getNetwork();
      const block = await provider.getBlockNumber();
      console.log(`[OK] ${url} -> ChainId: ${network.chainId}, Block: ${block}`);
      return provider;
    } catch (e) {
      console.log(`[FAIL] ${url} -> ${e.message}`);
    }
  }
}

testRpc();
