process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=======================================================================");
  console.log("             SCOUTMARKET BASESCAN SOURCE VERIFICATION                  ");
  console.log("=======================================================================");

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  if (!fs.existsSync(deployPath)) {
    throw new Error("No deployment found at deployed_addresses.json");
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;
  const arbitratorAddress = deploymentInfo.arbitrator;

  console.log(`Verifying contract at: ${contractAddress}`);
  console.log(`Constructor Argument (Arbitrator): ${arbitratorAddress}`);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [arbitratorAddress],
    });
    console.log("✅ Contract successfully verified on BaseScan!");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Contract is already verified on BaseScan.");
    } else {
      console.error("Verification error:", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
