process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const BuyerAgent = require("../agents/buyer_agent");
require("dotenv").config();

// Terminal-only "dispute" action against the live deployed contract: raises a
// real disputePurchase() from the buyer, then has the real 10-person juror
// committee (agents/.jurors.json, from `npm run setup:jurors`) cast real
// castVote() transactions until the dispute resolves.
//
// Usage:
//   PURCHASE_ID=6 npm run dispute
//   PURCHASE_ID=6 ACCEPT_VOTES=3 npm run dispute     (3 accept, rest deny — buyer wins)
//   PURCHASE_ID=6 ACCEPT_VOTES=0 npm run dispute     (all deny — seller wins)

const statusLabels = ["PendingReveal", "Revealed", "Confirmed", "Refunded", "Disputed"];

async function main() {
  const [, , buyerAccount] = await ethers.getSigners();
  if (!buyerAccount) throw new Error("BUYER_PK not configured in .env");

  const purchaseId = process.env.PURCHASE_ID ? Number(process.env.PURCHASE_ID) : null;
  if (!purchaseId) throw new Error("Set PURCHASE_ID env var, e.g. PURCHASE_ID=6 npm run dispute");

  const deployPath = path.join(__dirname, "../deployed_addresses.json");
  const { contractAddress } = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const artifact = require("../artifacts/contracts/ScoutMarket.sol/ScoutMarket.json");

  const buyerAgent = new BuyerAgent(buyerAccount, contractAddress, artifact.abi);
  const reason = process.env.REASON || "Delivered content does not match what the teaser promised.";
  const disputeTxHash = await buyerAgent.raiseDispute(purchaseId, reason, "0.001");
  console.log(`\n✅ Dispute filed on Purchase #${purchaseId}.`);
  console.log(`Tx: https://sepolia.etherscan.io/tx/${disputeTxHash}`);

  if (process.env.SKIP_VOTES) {
    console.log("\nSKIP_VOTES set — leaving the dispute open for manual voting (e.g. via /ui/arbitrator.html).");
    return;
  }

  const jurorsPath = path.join(__dirname, "../agents/.jurors.json");
  if (!fs.existsSync(jurorsPath)) {
    console.log("\nNo agents/.jurors.json found — skipping committee voting.");
    console.log("Run `npm run setup:jurors` first, or resolve manually via /ui/arbitrator.html or resolveDispute().");
    return;
  }

  const jurors = JSON.parse(fs.readFileSync(jurorsPath, "utf8"));
  const provider = ethers.provider;
  const contractRead = new ethers.Contract(contractAddress, artifact.abi, provider);

  const acceptVotesWanted = process.env.ACCEPT_VOTES !== undefined ? Number(process.env.ACCEPT_VOTES) : 3;
  console.log(`\n>>> Committee voting: up to ${acceptVotesWanted} juror(s) will vote ACCEPT, the rest DENY (stops early once resolved).`);

  for (let i = 0; i < jurors.length; i++) {
    const purchase = await contractRead.purchases(purchaseId);
    if (Number(purchase.status) !== 4) {
      console.log(`Already resolved (status=${statusLabels[Number(purchase.status)]}) — stopping after ${i} vote(s).`);
      break;
    }

    const jurorWallet = new ethers.Wallet(jurors[i].privateKey, provider);
    const contractAsJuror = new ethers.Contract(contractAddress, artifact.abi, jurorWallet);
    const acceptChallenge = i < acceptVotesWanted;

    const tx = await contractAsJuror.castVote(purchaseId, acceptChallenge);
    await tx.wait();
    console.log(`[Juror #${i}] ${jurors[i].address} voted ${acceptChallenge ? "ACCEPT" : "DENY"} — tx https://sepolia.etherscan.io/tx/${tx.hash}`);
  }

  const finalPurchase = await contractRead.purchases(purchaseId);
  console.log(`\nFinal status: ${statusLabels[Number(finalPurchase.status)]}`);
  console.log(`Accept votes: ${await contractRead.acceptVotes(purchaseId)} | Deny votes: ${await contractRead.denyVotes(purchaseId)}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
