// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ScoutMarketEncrypted
 * @notice PROTOTYPE — not deployed, not the submitted contract. Explores one fix to the
 *         "anyone can read it for free after reveal" limitation of ScoutMarket.sol.
 *
 * @dev The only real change from ScoutMarket.sol is revealIntel(): instead of submitting the
 *      plaintext (which the EVM re-hashes and checks against the commitment), the seller submits
 *      ciphertext — the plaintext encrypted off-chain to the BUYER's own public key using ECIES.
 *
 *      The trade-off, stated plainly: the contract can no longer verify the reveal itself. keccak256
 *      can hash the ciphertext, but it has no way to check that the ciphertext decrypts to something
 *      matching the original commitment — only the buyer's private key can do that, and a private key
 *      can never appear in a transaction. So the automatic "math, not trust" verification at reveal
 *      time is gone. In exchange, only the buyer can ever read the content — a random address reading
 *      the same transaction on Etherscan sees random bytes, not the report.
 *
 *      Verification moves from "automatic, at reveal" to "manual, by the buyer, after decrypting" —
 *      confirmReceipt() becomes the buyer's attestation that decryption produced the promised content,
 *      and disputePurchase() is now also the buyer's only recourse if it didn't.
 */
contract ScoutMarketEncrypted {

    enum ClaimCategory { Falsifiable, Subjective }

    enum PurchaseStatus {
        PendingReveal,
        Revealed,      // ciphertext posted — NOT hash-verified, only availability-guaranteed
        Confirmed,
        Refunded,
        Disputed
    }

    struct Listing {
        uint256 listingId;
        address seller;
        bytes32 contentCommitment;   // still committed at listing time, for the buyer to check off-chain
        string teaser;
        uint256 price;
        uint256 expiryTimestamp;
        ClaimCategory category;
        uint256 claimResolutionTimestamp;
        bool active;
        uint256 createdAt;
    }

    struct Purchase {
        uint256 purchaseId;
        uint256 listingId;
        address buyer;
        uint256 amountPaid;
        uint256 revealDeadline;
        PurchaseStatus status;
        bytes encryptedContent;      // ciphertext, decryptable only by purchase.buyer's private key
        uint256 disputedAt;
        string disputeReason;
    }

    struct SellerReputation {
        uint256 stake;
        uint256 completedSales;
        uint256 disputesWon;
        uint256 disputesLost;
        uint256 totalEarnings;
    }

    address public arbitrator;
    uint256 public minSellerStake = 0.01 ether;
    uint256 public disputeBond = 0.001 ether;
    uint256 public defaultRevealWindow = 1 hours;
    uint256 public slashAmount = 0.005 ether;

    uint256 public listingCounter;
    uint256 public purchaseCounter;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Purchase) public purchases;
    mapping(address => SellerReputation) public sellerReputations;

    event ListingCreated(uint256 indexed listingId, address indexed seller, bytes32 contentCommitment, string teaser, uint256 price);
    event IntelPurchased(uint256 indexed purchaseId, uint256 indexed listingId, address indexed buyer, uint256 amountPaid, uint256 revealDeadline);
    event IntelRevealed(uint256 indexed purchaseId, bytes encryptedContent);
    event PurchaseConfirmed(uint256 indexed purchaseId, address indexed seller, uint256 amountReleased);
    event DisputeRaised(uint256 indexed purchaseId, address indexed buyer, string reason);
    event DisputeResolved(uint256 indexed purchaseId, bool indexed buyerWins, string details);
    event JurorVoteCast(uint256 indexed purchaseId, address indexed juror, bool acceptChallenge, uint256 acceptVotes, uint256 denyVotes);

    // --- COMMITTEE ARBITRATION ---
    // Identical mechanism to ScoutMarket.sol: a fixed committee of registered juror
    // addresses, set once at deployment. A juror reads the buyer's disclosed plaintext
    // in disputeReason (the same thing the single arbitrator reads) and votes on it —
    // the encrypted-reveal change doesn't touch how disputes get judged, only how an
    // undisputed purchase stays confidential.
    uint256 public constant JUROR_VOTE_THRESHOLD = 3;
    address[] public jurors;
    mapping(address => bool) public isJuror;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256) public acceptVotes;
    mapping(uint256 => uint256) public denyVotes;

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "Only arbitrator can perform this action");
        _;
    }

    constructor(address _arbitrator, address[] memory _jurors) {
        require(_arbitrator != address(0), "Invalid arbitrator address");
        arbitrator = _arbitrator;
        for (uint256 i = 0; i < _jurors.length; i++) {
            require(_jurors[i] != address(0), "Invalid juror address");
            require(!isJuror[_jurors[i]], "Duplicate juror address");
            jurors.push(_jurors[i]);
            isJuror[_jurors[i]] = true;
        }
    }

    function jurorCount() external view returns (uint256) {
        return jurors.length;
    }

    function getJurors() external view returns (address[] memory) {
        return jurors;
    }

    function depositStake() external payable {
        require(msg.value > 0, "Deposit amount must be > 0");
        sellerReputations[msg.sender].stake += msg.value;
    }

    function createListing(
        bytes32 contentCommitment,
        string calldata teaser,
        uint256 price,
        uint256 expiryTimestamp,
        ClaimCategory category,
        uint256 claimResolutionTimestamp
    ) external returns (uint256 listingId) {
        require(sellerReputations[msg.sender].stake >= minSellerStake, "Seller stake below required minimum");
        require(contentCommitment != bytes32(0), "Commitment cannot be empty");
        require(expiryTimestamp > block.timestamp, "Expiry must be in the future");

        listingCounter++;
        listingId = listingCounter;

        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            contentCommitment: contentCommitment,
            teaser: teaser,
            price: price,
            expiryTimestamp: expiryTimestamp,
            category: category,
            claimResolutionTimestamp: claimResolutionTimestamp,
            active: true,
            createdAt: block.timestamp
        });

        emit ListingCreated(listingId, msg.sender, contentCommitment, teaser, price);
    }

    function buyIntel(uint256 listingId) external payable returns (uint256 purchaseId) {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing is not active");
        require(block.timestamp <= listing.expiryTimestamp, "Listing has expired");
        require(msg.value == listing.price, "Incorrect ETH amount sent");

        purchaseCounter++;
        purchaseId = purchaseCounter;
        uint256 revealDeadline = block.timestamp + defaultRevealWindow;

        purchases[purchaseId] = Purchase({
            purchaseId: purchaseId,
            listingId: listingId,
            buyer: msg.sender,
            amountPaid: msg.value,
            revealDeadline: revealDeadline,
            status: PurchaseStatus.PendingReveal,
            encryptedContent: "",
            disputedAt: 0,
            disputeReason: ""
        });

        emit IntelPurchased(purchaseId, listingId, msg.sender, msg.value, revealDeadline);
    }

    /**
     * @notice Seller reveals CIPHERTEXT — the plaintext encrypted off-chain to the buyer's public key.
     * @dev No hash check here — the contract cannot decrypt, so it cannot verify. It only guarantees
     *      availability (the ciphertext is now permanently retrievable) and non-repudiation (the seller
     *      can't later claim they sent something else). Correctness is the buyer's job, after decrypting.
     */
    function revealIntel(uint256 purchaseId, bytes calldata encryptedContent) external {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];

        require(msg.sender == listing.seller, "Only seller can reveal intel");
        require(purchase.status == PurchaseStatus.PendingReveal, "Purchase not pending reveal");
        require(block.timestamp <= purchase.revealDeadline, "Reveal deadline passed");
        require(encryptedContent.length > 0, "Ciphertext cannot be empty");

        purchase.status = PurchaseStatus.Revealed;
        purchase.encryptedContent = encryptedContent;

        emit IntelRevealed(purchaseId, encryptedContent);
    }

    /**
     * @notice Buyer confirms that, having decrypted encryptedContent off-chain, it matches what was
     *         promised. This is now an attestation, not a re-derivation the EVM can check itself.
     */
    function confirmReceipt(uint256 purchaseId) external {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];

        require(msg.sender == purchase.buyer, "Only buyer can confirm receipt");
        require(purchase.status == PurchaseStatus.Revealed, "Purchase must be in Revealed state");

        purchase.status = PurchaseStatus.Confirmed;
        uint256 payout = purchase.amountPaid;
        purchase.amountPaid = 0;

        SellerReputation storage sellerRep = sellerReputations[listing.seller];
        sellerRep.completedSales++;
        sellerRep.totalEarnings += payout;

        payable(listing.seller).transfer(payout);
        emit PurchaseConfirmed(purchaseId, listing.seller, payout);
    }

    /**
     * @notice Buyer disputes — now the ONLY path that catches a hash mismatch, since revealIntel no
     *         longer checks it. The buyer must include the decrypted plaintext in `reason` so the
     *         arbitrator can verify keccak256(plaintext) against the original public commitment.
     *         This is the confidentiality trade-off made concrete: a dispute re-exposes the content
     *         (to the arbitrator, not the world), but an undisputed purchase never does.
     */
    function disputePurchase(uint256 purchaseId, string calldata reason) external payable {
        Purchase storage purchase = purchases[purchaseId];
        require(msg.sender == purchase.buyer, "Only buyer can dispute");
        require(
            purchase.status == PurchaseStatus.Revealed || purchase.status == PurchaseStatus.PendingReveal,
            "Invalid status for dispute"
        );
        require(msg.value == disputeBond, "Dispute bond required");

        purchase.status = PurchaseStatus.Disputed;
        purchase.disputedAt = block.timestamp;
        purchase.disputeReason = reason;

        emit DisputeRaised(purchaseId, msg.sender, reason);
    }

    /**
     * @notice Arbitrator checks the buyer's disclosed plaintext (in disputeReason) against the
     *         original public commitment before ruling — the one place hash-verification still happens.
     * @dev Kept as a manual override alongside the committee's castVote() path, exactly like
     *      ScoutMarket.sol — either one can settle a Disputed purchase, whichever rules first.
     */
    function resolveDispute(uint256 purchaseId, bool buyerWins, string calldata details) external onlyArbitrator {
        require(purchases[purchaseId].status == PurchaseStatus.Disputed, "Purchase is not in disputed state");
        _settleDispute(purchaseId, buyerWins, details);
    }

    /**
     * @notice A registered committee juror votes on an active dispute, having independently
     *         read the buyer's disclosed plaintext (disputeReason) against the public commitment —
     *         same information the single arbitrator uses, just judged by ten people instead of one.
     */
    function castVote(uint256 purchaseId, bool acceptChallenge) external {
        require(isJuror[msg.sender], "Only registered committee jurors can vote");
        require(purchases[purchaseId].status == PurchaseStatus.Disputed, "Purchase is not in disputed state");
        require(!hasVoted[purchaseId][msg.sender], "Juror has already voted on this dispute");

        hasVoted[purchaseId][msg.sender] = true;

        if (acceptChallenge) {
            acceptVotes[purchaseId]++;
        } else {
            denyVotes[purchaseId]++;
        }

        emit JurorVoteCast(purchaseId, msg.sender, acceptChallenge, acceptVotes[purchaseId], denyVotes[purchaseId]);

        if (acceptVotes[purchaseId] >= JUROR_VOTE_THRESHOLD) {
            _settleDispute(purchaseId, true, "Committee ruling: accept-vote threshold reached, buyer wins.");
        } else if (denyVotes[purchaseId] > jurors.length - JUROR_VOTE_THRESHOLD) {
            _settleDispute(purchaseId, false, "Committee ruling: accept threshold no longer reachable, seller wins.");
        }
    }

    /**
     * @dev Shared settlement logic for both the single-arbitrator override and the juror
     *      committee — identical payout/reputation effects regardless of which path ruled.
     */
    function _settleDispute(uint256 purchaseId, bool buyerWins, string memory details) internal {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];
        SellerReputation storage sellerRep = sellerReputations[listing.seller];

        if (buyerWins) {
            purchase.status = PurchaseStatus.Refunded;
            sellerRep.disputesLost++;
            uint256 totalRefund = purchase.amountPaid + disputeBond;
            purchase.amountPaid = 0;
            uint256 penalty = sellerRep.stake >= slashAmount ? slashAmount : sellerRep.stake;
            if (penalty > 0) {
                sellerRep.stake -= penalty;
                totalRefund += penalty;
            }
            payable(purchase.buyer).transfer(totalRefund);
        } else {
            purchase.status = PurchaseStatus.Confirmed;
            sellerRep.disputesWon++;
            sellerRep.completedSales++;
            uint256 totalPayout = purchase.amountPaid + disputeBond;
            purchase.amountPaid = 0;
            sellerRep.totalEarnings += totalPayout;
            payable(listing.seller).transfer(totalPayout);
        }

        emit DisputeResolved(purchaseId, buyerWins, details);
    }
}
