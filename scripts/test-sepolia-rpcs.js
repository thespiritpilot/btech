process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("ethers");

async function testSepoliaRpcs() {
  const rpcs = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://1rpc.io/sepolia",
    "https://sepolia.drpc.org",
    "https://gateway.tenderly.co/public/sepolia",
    "https://rpc.ankr.com/eth_sepolia"
  ];

  for (const url of rpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      const block = await provider.getBlockNumber();
      console.log(`[OK] ${url} -> Block ${block}`);
    } catch (e) {
      console.log(`[FAIL] ${url} -> ${e.message}`);
    }
  }
}

testSepoliaRpcs();
