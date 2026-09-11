process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("ethers");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runPipeline() {
  console.log("=======================================================================");
  console.log("          SCOUTMARKET AUTONOMOUS BASE SEPOLIA PIPELINE                ");
  console.log("=======================================================================");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const deployerPk = process.env.DEPLOYER_PK.trim();
  const sellerPk = process.env.SELLER_PK.trim();
  const buyerPk = process.env.BUYER_PK.trim();
  const arbitratorPk = process.env.ARBITRATOR_PK.trim();

  const deployerWallet = new ethers.Wallet(deployerPk.startsWith("0x") ? deployerPk : `0x${deployerPk}`, provider);
  const sellerWallet = new ethers.Wallet(sellerPk.startsWith("0x") ? sellerPk : `0x${sellerPk}`, provider);
  const buyerWallet = new ethers.Wallet(buyerPk.startsWith("0x") ? buyerPk : `0x${buyerPk}`, provider);
  const arbitratorWallet = new ethers.Wallet(arbitratorPk.startsWith("0x") ? arbitratorPk : `0x${arbitratorPk}`, provider);

  console.log(`[Target Deployer Address]: ${deployerWallet.address}`);
  console.log(`[Target Seller Address]:   ${sellerWallet.address}`);
  console.log(`[Target Buyer Address]:    ${buyerWallet.address}`);
  console.log(`[Target Arbitrator]:       ${arbitratorWallet.address}`);
  console.log("-----------------------------------------------------------------------");

  // PHASE 1: Poll for Deployer balance
  console.log(">>> PHASE 1: Polling Deployer balance on Base Sepolia...");
  let deployerBal = 0n;
  let attempts = 0;
  while (attempts < 120) {
    try {
      deployerBal = await provider.getBalance(deployerWallet.address);
      const balEth = parseFloat(ethers.formatEther(deployerBal));
      console.log(`[${new Date().toLocaleTimeString()}] Deployer Balance: ${balEth.toFixed(5)} ETH`);
      if (balEth >= 0.02) {
        console.log(`\n✅ Deployer funded! Proceeding with distribution...`);
        break;
      }
    } catch (e) {
      console.log(`Polling error: ${e.message}`);
    }
    attempts++;
    await new Promise(r => setTimeout(r, 6000));
  }

  if (deployerBal < ethers.parseEther("0.02")) {
    console.log("⚠️ Still waiting for deployer funds. Balance under 0.02 ETH.");
    return;
  }

  // PHASE 2: Distribute to accounts
  console.log("\n>>> PHASE 2: Distributing testnet funds to Seller, Buyer, Arbitrator...");
  const totalEth = parseFloat(ethers.formatEther(deployerBal));
  // Calculate per-account amount: 0.02 if >= 0.08, or 25% of balance
  let sendAmountEth = "0.02";
  if (totalEth < 0.08) {
    sendAmountEth = (totalEth * 0.22).toFixed(4);
  }
  const sendAmountWei = ethers.parseEther(sendAmountEth);
  console.log(`Sending ${sendAmountEth} ETH to each of the 3 role accounts...`);

  const distributionTxs = [];
  const roles = [
    { role: "Seller", wallet: sellerWallet },
    { role: "Buyer", wallet: buyerWallet },
    { role: "Arbitrator", wallet: arbitratorWallet }
  ];

  for (const r of roles) {
    const curBal = await provider.getBalance(r.wallet.address);
    if (curBal >= ethers.parseEther("0.01")) {
      console.log(`${r.role} already has ${ethers.formatEther(curBal)} ETH, skipping funding.`);
      continue;
    }
    console.log(`Transferring ${sendAmountEth} ETH to ${r.role} (${r.wallet.address})...`);
    const tx = await deployerWallet.sendTransaction({
      to: r.wallet.address,
      value: sendAmountWei
    });
    console.log(`Tx submitted: https://sepolia.basescan.org/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);
    distributionTxs.push({ role: r.role, txHash: tx.hash, link: `https://sepolia.basescan.org/tx/${tx.hash}` });
  }

  // PHASE 3: Deploy Contract to Base Sepolia
  console.log("\n>>> PHASE 3: Deploying ScoutMarket to Base Sepolia...");
  execSync("npx hardhat run scripts/deploy.js --network baseSepolia", { stdio: "inherit" });

  const deployedInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployed_addresses.json"), "utf8"));
  console.log(`\nContract deployed at: ${deployedInfo.contractAddress}`);
  console.log(`BaseScan: https://sepolia.basescan.org/address/${deployedInfo.contractAddress}`);

  // PHASE 4: Run Happy Path Live
  console.log("\n>>> PHASE 4: Running Happy-Path Agent Loop on Base Sepolia...");
  execSync("npx hardhat run scripts/run_demo.js --network baseSepolia", { stdio: "inherit" });

  // PHASE 5: Run Dispute Simulation Live
  console.log("\n>>> PHASE 5: Running Dispute & Slashing Loop on Base Sepolia...");
  execSync("npx hardhat run scripts/simulate_dispute.js --network baseSepolia", { stdio: "inherit" });

  console.log("\n=======================================================================");
  console.log("       ALL BASE SEPOLIA TESTNET RUNS COMPLETED SUCCESSFULLY!           ");
  console.log("=======================================================================");
}

runPipeline().catch(console.error);
