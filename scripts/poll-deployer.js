process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("ethers");
require("dotenv").config();

async function poll() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const deployerPk = process.env.DEPLOYER_PK.trim();
  const deployerWallet = new ethers.Wallet(deployerPk.startsWith("0x") ? deployerPk : `0x${deployerPk}`, provider);
  const deployerAddress = deployerWallet.address;

  console.log(`Polling balance for Deployer: ${deployerAddress} on Base Sepolia...`);

  let count = 0;
  while (count < 30) {
    try {
      const balWei = await provider.getBalance(deployerAddress);
      const balEth = parseFloat(ethers.formatEther(balWei));
      console.log(`[Attempt ${count+1}] Balance: ${balEth.toFixed(6)} ETH`);
      if (balEth >= 0.05) { // If at least 0.05 ETH (or 0.08)
        console.log(`\n🎉 Deployer is funded! Balance: ${balEth} ETH.`);
        return true;
      }
    } catch (e) {
      console.log(`Error checking balance: ${e.message}`);
    }
    count++;
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

poll().then(success => {
  if (!success) {
    console.log("Timed out waiting for funds. Please check faucet transaction.");
    process.exit(1);
  }
});
