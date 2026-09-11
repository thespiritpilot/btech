process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("=======================================================================");
  console.log(`       SCOUTMARKET DEPLOYMENT — TARGET NETWORK: ${network.name.toUpperCase()}       `);
  console.log("=======================================================================");

  const signers = await ethers.getSigners();
  const [deployer, seller, buyer, arbitrator] = signers;

  const arbitratorAddress = arbitrator ? arbitrator.address : deployer.address;

  console.log(`[Role Mapping] Deployer:   ${deployer.address}`);
  console.log(`[Role Mapping] Arbitrator: ${arbitratorAddress}`);
  if (seller) console.log(`[Role Mapping] Seller:     ${seller.address}`);
  if (buyer)  console.log(`[Role Mapping] Buyer:      ${buyer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.address} has 0 ETH on ${network.name}. Please fund via faucet before deploying.`);
  }

  // Juror committee (see scripts/setup_jurors.js) — 10 dedicated addresses that
  // can each cast one vote per dispute via castVote(). Falls back to an empty
  // committee if that setup script hasn't been run, in which case only the
  // single arbitrator can resolve disputes (via resolveDispute()).
  let jurorAddresses = [];
  const jurorsPath = path.join(__dirname, "../agents/.jurors.json");
  if (fs.existsSync(jurorsPath)) {
    const jurorData = JSON.parse(fs.readFileSync(jurorsPath, "utf8"));
    jurorAddresses = jurorData.map(j => j.address);
    console.log(`[Role Mapping] Juror Committee: ${jurorAddresses.length} addresses loaded from agents/.jurors.json`);
  } else {
    console.log("[Role Mapping] No agents/.jurors.json found — deploying with an empty juror committee.");
  }

  console.log("\nDeploying ScoutMarket contract...");
  const ScoutMarket = await ethers.getContractFactory("ScoutMarket", deployer);
  const scoutMarket = await ScoutMarket.deploy(arbitratorAddress, jurorAddresses);
  
  const deploymentTx = scoutMarket.deploymentTransaction();
  console.log(`Deployment Tx Hash: ${deploymentTx ? deploymentTx.hash : "N/A"}`);

  await scoutMarket.waitForDeployment();
  const contractAddress = await scoutMarket.getAddress();

  console.log(`✅ ScoutMarket deployed successfully!`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Arbitrator:       ${arbitratorAddress}`);

  let explorerUrl = "";
  if (network.name === "sepolia") {
    explorerUrl = `https://sepolia.etherscan.io/address/${contractAddress}`;
    console.log(`Sepolia Etherscan: ${explorerUrl}`);
  } else if (network.name === "baseSepolia") {
    explorerUrl = `https://sepolia.basescan.org/address/${contractAddress}`;
    console.log(`BaseScan Explorer: ${explorerUrl}`);
  }

  // Save deployment metadata
  const deploymentInfo = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contractAddress: contractAddress,
    deployer: deployer.address,
    arbitrator: arbitratorAddress,
    jurors: jurorAddresses,
    deploymentTxHash: deploymentTx ? deploymentTx.hash : null,
    explorerUrl: explorerUrl,
    deployedAt: new Date().toISOString()
  };

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  fs.writeFileSync(deployPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Saved deployment details to ${deployPath}`);
  console.log("=======================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
