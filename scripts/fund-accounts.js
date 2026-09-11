process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=======================================================================");
  console.log("             DISTRIBUTE TESTNET FUNDS FROM DEPLOYER                    ");
  console.log("=======================================================================");

  const rpcUrls = [
    process.env.BASE_SEPOLIA_RPC,
    "https://sepolia.base.org",
    "https://base-sepolia.blockpi.network/v1/rpc/public"
  ].filter(Boolean);

  let provider;
  for (const url of rpcUrls) {
    try {
      provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      console.log(`Connected to Base Sepolia RPC: ${url}`);
      break;
    } catch (e) {
      console.log(`RPC ${url} unreachable (${e.message}), trying next...`);
    }
  }

  if (!provider) {
    throw new Error("Could not connect to any Base Sepolia RPC");
  }

  const deployerPk = process.env.DEPLOYER_PK.trim();
  const deployerWallet = new ethers.Wallet(deployerPk.startsWith("0x") ? deployerPk : `0x${deployerPk}`, provider);

  const sellerWallet = new ethers.Wallet(process.env.SELLER_PK.trim().startsWith("0x") ? process.env.SELLER_PK.trim() : `0x${process.env.SELLER_PK.trim()}`, provider);
  const buyerWallet = new ethers.Wallet(process.env.BUYER_PK.trim().startsWith("0x") ? process.env.BUYER_PK.trim() : `0x${process.env.BUYER_PK.trim()}`, provider);
  const arbitratorWallet = new ethers.Wallet(process.env.ARBITRATOR_PK.trim().startsWith("0x") ? process.env.ARBITRATOR_PK.trim() : `0x${process.env.ARBITRATOR_PK.trim()}`, provider);

  const deployerBal = await provider.getBalance(deployerWallet.address);
  console.log(`Deployer Address: ${deployerWallet.address}`);
  console.log(`Deployer Balance: ${ethers.formatEther(deployerBal)} ETH`);

  const amountToSend = ethers.parseEther("0.02");
  const recipients = [
    { role: "Seller", address: sellerWallet.address },
    { role: "Buyer", address: buyerWallet.address },
    { role: "Arbitrator", address: arbitratorWallet.address }
  ];

  for (const rec of recipients) {
    console.log(`\nSending 0.02 ETH to ${rec.role} (${rec.address})...`);
    const tx = await deployerWallet.sendTransaction({
      to: rec.address,
      value: amountToSend
    });
    console.log(`Tx submitted: ${tx.hash}`);
    console.log(`BaseScan Link: https://sepolia.basescan.org/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}!`);
  }

  console.log("\nDistribution complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
