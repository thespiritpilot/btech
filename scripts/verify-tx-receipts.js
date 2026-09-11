process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("ethers");

async function verifyAllTxs() {
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");

  const txs = [
    { name: "Contract Deployment", hash: "0x58e17b6c77eecc47681e301a3214e3bfa2d2a10b81c452d24c6daba42289fd99" },
    { name: "Happy Path - Seller Staking", hash: "0x263a97e196fc42dcc637ea5b47f6f072998e3b571f9fe7467eea6b53629d9f1b" },
    { name: "Happy Path - Listing Created", hash: "0x5371978b80a5e5a04f6a75dedd93d571cb59da6f18b3514e2c0aa903591d53ee" },
    { name: "Happy Path - Escrow Payment", hash: "0x3f1829567136862b63782125ba5047bc7069fbff47d6002c4ce30fac3f87a2e2" },
    { name: "Happy Path - Proof of Reveal", hash: "0x506c0826308ada2ab28a7ee748146539b422c8c214c3b6ec1c399dd5ad06b4fa" },
    { name: "Happy Path - Receipt Confirmed & Released", hash: "0xf7382c73255f8a5d925195ce732554352d01f02d7d1057e37af8254d31d6616f" },
    { name: "Dispute Path - Listing Created", hash: "0x175809dd83566602f949b8f71f289ebe8281f5ffbdfae6ea3c13d5df25415cf9" },
    { name: "Dispute Path - Escrow Payment", hash: "0xe24b625207a23365c1c19ac2e47e9d116b18e68977b2c70bef45e614373f0ed8" },
    { name: "Dispute Path - Proof of Reveal", hash: "0xff2749dea6df505d63a0e324424aa925474c3721a542f205cf720aa28d9e4281" },
    { name: "Dispute Path - Dispute Filed", hash: "0x918ec838319fee8025673dfeec1e8d5933cc343c046b48408a44b98b091dd468" },
    { name: "Dispute Path - Arbitrator Ruling & Stake Slashed", hash: "0x42bc33319f8f1163dbff932b3fabe694122d7a6bef31dfb6c4a4392b67ff8974" }
  ];

  console.log("=======================================================================");
  console.log("            CONFIRMING ALL SEPOLIA TRANSACTIONS ON-CHAIN               ");
  console.log("=======================================================================");

  for (const t of txs) {
    const receipt = await provider.getTransactionReceipt(t.hash);
    if (!receipt) {
      console.log(`❌ [NOT FOUND] ${t.name}: ${t.hash}`);
    } else {
      console.log(`✅ [CONFIRMED in Block ${receipt.blockNumber}] ${t.name}`);
      console.log(`   Tx: https://sepolia.etherscan.io/tx/${t.hash}`);
    }
  }
  console.log("=======================================================================");
}

verifyAllTxs().catch(console.error);
