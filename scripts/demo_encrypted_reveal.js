/**
 * PROTOTYPE DEMO — encrypted reveal, run on a local Hardhat network (not Sepolia, not the
 * submitted contract). Proves the mechanism described in ScoutMarketEncrypted.sol:
 *
 *   1. Seller commits keccak256(plaintext) at listing time, same as the real ScoutMarket.
 *   2. Buyer buys, same as the real ScoutMarket.
 *   3. Seller encrypts the plaintext to the BUYER's public key (ECIES / secp256k1, via eth-crypto)
 *      and submits only the ciphertext on-chain.
 *   4. A THIRD PARTY (nobody's business) tries to read the ciphertext straight off the event log —
 *      exactly what "some random person reading Etherscan" would do today — and fails.
 *   5. The real buyer decrypts with their own private key, then independently re-hashes the
 *      decrypted plaintext and checks it against the public commitment — proving delivery was
 *      honest without the contract ever seeing the plaintext.
 *
 * Run: npx hardhat run scripts/demo_encrypted_reveal.js
 */
const hre = require("hardhat");
const EthCrypto = require("eth-crypto");
const { ethers } = hre;

async function main() {
  const [deployer, sellerSigner, arbitratorSigner] = await ethers.getSigners();

  // A fresh, independent keypair for the buyer — deliberately NOT one of Hardhat's built-in
  // signers, to prove this works with any plain secp256k1 keypair, exactly like a real agent's.
  const buyerIdentity = EthCrypto.createIdentity();
  const buyerWallet = new ethers.Wallet(buyerIdentity.privateKey, ethers.provider);
  await deployer.sendTransaction({ to: buyerWallet.address, value: ethers.parseEther("2") });

  console.log("Seller   :", sellerSigner.address);
  console.log("Buyer    :", buyerWallet.address, "(fresh eth-crypto keypair, funded by deployer)");
  console.log("Arbiter  :", arbitratorSigner.address);
  console.log("");

  const Factory = await ethers.getContractFactory("ScoutMarketEncrypted", sellerSigner);
  const contract = await Factory.deploy(arbitratorSigner.address, []); // no jurors needed for this demo
  await contract.waitForDeployment();
  console.log("ScoutMarketEncrypted deployed to (local):", await contract.getAddress());

  // --- 1. Seller stakes + hashes the plaintext + lists ---
  const plaintext = "Grade-2 hamstring strain, re-injury risk within 8 weeks.";
  const commitment = ethers.keccak256(ethers.toUtf8Bytes(plaintext));

  await (await contract.connect(sellerSigner).depositStake({ value: ethers.parseEther("0.01") })).wait();

  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const price = ethers.parseEther("0.002");
  await (await contract.connect(sellerSigner).createListing(
    commitment, "[Health Flag] Marcus Vance — Georgia", price, expiry, 0, expiry
  )).wait();
  console.log("\nListing created. Public commitment:", commitment);
  console.log("(the real sentence has not gone anywhere yet)");

  // --- 2. Buyer buys ---
  await (await contract.connect(buyerWallet).buyIntel(1, { value: price })).wait();
  console.log("\nBuyer paid into escrow. Purchase #1 status: PendingReveal");

  // --- 3. Seller encrypts to the BUYER's public key, reveals ciphertext only ---
  const encryptedObj = await EthCrypto.encryptWithPublicKey(buyerIdentity.publicKey, plaintext);
  const ciphertextBytes = ethers.hexlify(ethers.toUtf8Bytes(EthCrypto.cipher.stringify(encryptedObj)));

  await (await contract.connect(sellerSigner).revealIntel(1, ciphertextBytes)).wait();
  console.log("\nSeller revealed CIPHERTEXT on-chain (not plaintext).");
  console.log("On-chain bytes (what Etherscan shows anyone):", ciphertextBytes.slice(0, 60) + "...");

  // --- 4. A random third party tries to read it straight from the chain ---
  const purchaseOnChain = await contract.purchases(1);
  const rawOnChainBytes = purchaseOnChain.encryptedContent;
  let thirdPartyReadSucceeded = false;
  try {
    const asText = ethers.toUtf8String(rawOnChainBytes); // this is JUST the ciphertext JSON, not the secret
    if (asText.includes("hamstring")) thirdPartyReadSucceeded = true;
  } catch (_) { /* not even valid readable plaintext */ }
  console.log("\nThird party reads the same on-chain bytes everyone can see...");
  console.log("Does it contain the actual scouting report?", thirdPartyReadSucceeded ? "YES (BAD)" : "NO — it's ciphertext gibberish");

  // --- 5. The real buyer decrypts with their private key and verifies the hash themselves ---
  const decryptedObj = EthCrypto.cipher.parse(ethers.toUtf8String(rawOnChainBytes));
  const decryptedPlaintext = await EthCrypto.decryptWithPrivateKey(buyerIdentity.privateKey, decryptedObj);
  const buyerRecomputedHash = ethers.keccak256(ethers.toUtf8Bytes(decryptedPlaintext));
  const listingOnChain = await contract.listings(1);

  console.log("\nBuyer decrypts with their own private key:");
  console.log(" -> recovered plaintext :", JSON.stringify(decryptedPlaintext));
  console.log(" -> matches original?   :", decryptedPlaintext === plaintext);
  console.log(" -> re-hash matches the public commitment from listing time?",
    buyerRecomputedHash === listingOnChain.contentCommitment);

  if (decryptedPlaintext === plaintext && buyerRecomputedHash === listingOnChain.contentCommitment) {
    await (await contract.connect(buyerWallet).confirmReceipt(1)).wait();
    console.log("\nBuyer confirmed receipt. Escrow released to seller. Purchase #1 status: Confirmed.");
  }

  console.log("\n--- RESULT ---");
  console.log("Mechanism works: content stayed unreadable to a third party, and the buyer could");
  console.log("still verify honesty themselves, without the contract ever seeing the plaintext.");
  console.log("Trade-off paid: the CONTRACT no longer verifies the reveal automatically — see");
  console.log("ScoutMarketEncrypted.sol's disputePurchase()/resolveDispute() for where that check moved.");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
