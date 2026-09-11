process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
require("dotenv").config();

async function main() {
  const targetNetwork = network.name || "sepolia";
  console.log("=======================================================================");
  console.log(`       ACCOUNT BALANCE VERIFIER — NETWORK: ${targetNetwork.toUpperCase()}       `);
  console.log("=======================================================================");

  const signers = await ethers.getSigners();
  const [deployer, seller, buyer, arbitrator] = signers;

  const accounts = [
    { role: "Deployer", signer: deployer, envVar: "DEPLOYER_PK" },
    { role: "Seller",   signer: seller,   envVar: "SELLER_PK" },
    { role: "Buyer",    signer: buyer,    envVar: "BUYER_PK" },
    { role: "Arbitrator", signer: arbitrator, envVar: "ARBITRATOR_PK" }
  ];

  const minRequiredEth = 0.02;
  const underfunded = [];

  for (const acct of accounts) {
    if (!acct.signer) {
      console.log(`❌ [${acct.role.padEnd(10)}] Missing signer configuration (${acct.envVar})`);
      underfunded.push({ role: acct.role, address: "NOT_SET", balance: 0, reason: "Missing Private Key" });
      continue;
    }

    try {
      const balanceWei = await ethers.provider.getBalance(acct.signer.address);
      const balanceEth = parseFloat(ethers.formatEther(balanceWei));

      const statusIcon = balanceEth >= minRequiredEth ? "✅" : "⚠️";
      console.log(`${statusIcon} [${acct.role.padEnd(10)}] Address: ${acct.signer.address} | Balance: ${balanceEth.toFixed(4)} ETH`);

      if (balanceEth < minRequiredEth) {
        underfunded.push({ role: acct.role, address: acct.signer.address, balance: balanceEth, reason: `Need >= ${minRequiredEth} ETH` });
      }
    } catch (err) {
      console.log(`❌ [${acct.role.padEnd(10)}] Error querying balance: ${err.message}`);
      underfunded.push({ role: acct.role, address: acct.signer.address, balance: 0, reason: err.message });
    }
  }

  console.log("-----------------------------------------------------------------------");

  if (underfunded.length > 0) {
    console.log("\n⚠️ FUNDING REQUIRED BEFORE LIVE TESTNET EXECUTION:");
    console.log(`Threshold required: ~${minRequiredEth} ETH per account on ${targetNetwork}\n`);
    for (const item of underfunded) {
      console.log(`• Role: ${item.role.padEnd(10)} Address: ${item.address} (Current: ${item.balance} ETH) - ${item.reason}`);
    }
    console.log("\nSepolia Etherscan Links to fund / inspect:");
    for (const item of underfunded) {
      if (item.address !== "NOT_SET" && item.address !== "INVALID") {
        console.log(`  - ${item.role.padEnd(10)}: https://sepolia.etherscan.io/address/${item.address}`);
      }
    }
  } else {
    console.log(`\n✅ ALL ACCOUNTS SUFFICIENTLY FUNDED (>= 0.02 ETH)! Ready to deploy to ${targetNetwork}.`);
  }
  console.log("=======================================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
