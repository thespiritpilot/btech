process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Generates a fixed committee of JUROR_COUNT fresh wallets, funds each with
// enough Sepolia ETH to pay gas for a handful of castVote() transactions, and
// saves the full keypairs to a local, gitignored file. The addresses (never
// the private keys) get passed into ScoutMarket's constructor at deploy time.
//
// This is an openly-acknowledged limitation, not a hidden one: all 10 keys
// are generated and held by the same operator (you), so this proves the
// *mechanism* (distinct on-chain signers, tallied votes, automatic payout)
// without being a genuinely decentralized, Sybil-resistant jury. A real
// version needs open staking + random sortition (e.g. Kleros).

const JUROR_COUNT = 10;
const FUND_AMOUNT_ETH = "0.0015";

async function main() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;

  console.log("=======================================================================");
  console.log(`  GENERATING ${JUROR_COUNT}-PERSON JUROR COMMITTEE [${network.name.toUpperCase()}]`);
  console.log("=======================================================================");

  const balance = await ethers.provider.getBalance(deployer.address);
  const totalNeeded = ethers.parseEther(FUND_AMOUNT_ETH) * BigInt(JUROR_COUNT);
  console.log(`Deployer: ${deployer.address} (${ethers.formatEther(balance)} ETH)`);
  console.log(`Funding each juror with ${FUND_AMOUNT_ETH} ETH (${ethers.formatEther(totalNeeded)} ETH total)...\n`);

  if (balance < totalNeeded) {
    throw new Error(`Deployer balance too low. Need at least ${ethers.formatEther(totalNeeded)} ETH, have ${ethers.formatEther(balance)} ETH.`);
  }

  const jurors = [];
  for (let i = 0; i < JUROR_COUNT; i++) {
    const wallet = ethers.Wallet.createRandom();
    jurors.push({ index: i, address: wallet.address, privateKey: wallet.privateKey });
  }

  for (const juror of jurors) {
    const tx = await deployer.sendTransaction({
      to: juror.address,
      value: ethers.parseEther(FUND_AMOUNT_ETH)
    });
    await tx.wait();
    console.log(`[Juror #${juror.index}] ${juror.address} funded — tx ${tx.hash}`);
  }

  const outPath = path.join(__dirname, "../agents/.jurors.json");
  fs.writeFileSync(outPath, JSON.stringify(jurors, null, 2));

  console.log(`\nSaved full juror keypairs to ${outPath}`);
  console.log("This file is gitignored — never commit it.");
  console.log("\nJuror addresses (public, safe to reuse anywhere):");
  jurors.forEach(j => console.log(`  ${j.index}: ${j.address}`));
  console.log("=======================================================================\n");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
