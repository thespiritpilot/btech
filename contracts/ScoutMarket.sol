// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ScoutMarket
 * @notice On-chain marketplace for unverifiable sports scouting intelligence trading.
 * @dev Implements seller staking, commit-reveal delivery, escrow holding, dispute arbitration,
 *      falsifiable claim resolution tracking, and composite reputation scores for autonomous agents.
 */
contract ScoutMarket {

    enum ClaimCategory {
        Falsifiable, // Has concrete resolution date (e.g., injury, draft position, contract signing)
        Subjective   // Tactical film study, team fit, qualitative assessment
    }

    enum PurchaseStatus {
        PendingReveal, // Buyer locked ETH in escrow, waiting seller reveal
        Revealed,      // Seller revealed intel on-chain, hash verified
        Confirmed,     // Buyer confirmed receipt, escrow released to seller
        Refunded,      // Refunded due to timeout or dispute resolution
        Disputed       // Buyer raised dispute, awaiting arbitration
    }

    struct Listing {
        uint256 listingId;
        address seller;
        bytes32 contentCommitment;        // keccak256 hash of plaintext intel / decryption key
        string teaser;                    // Public redacted summary
        uint256 price;                    // Price in wei
        uint256 expiryTimestamp;          // Hard expiration after which purchase is disallowed
        ClaimCategory category;
        uint256 claimResolutionTimestamp; // Expected real-world verification timestamp
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
        string revealedContent;
        uint256 disputedAt;
        string disputeReason;
    }

    struct SellerReputation {
        uint256 stake;
        uint256 completedSales;
        uint256 disputesWon;
        uint256 disputesLost;
        uint256 resolvedClaims;
        uint256 accurateClaims;
        uint256 totalEarnings;
    }

    // Parameters
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
    mapping(address => uint256[]) public sellerListings;
    mapping(address => uint256[]) public buyerPurchases;

    // Events
    event StakeDeposited(address indexed seller, uint256 amount, uint256 newTotalStake);
    event StakeWithdrawn(address indexed seller, uint256 amount, uint256 remainingStake);
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        bytes32 contentCommitment,
        string teaser,
        uint256 price,
        uint256 expiryTimestamp,
        ClaimCategory category,
        uint256 claimResolutionTimestamp
    );
    event IntelPurchased(
        uint256 indexed purchaseId,
        uint256 indexed listingId,
        address indexed buyer,
        uint256 amountPaid,
        uint256 revealDeadline
    );
    event IntelRevealed(uint256 indexed purchaseId, string revealedContent);
    event PurchaseConfirmed(uint256 indexed purchaseId, address indexed seller, uint256 amountReleased);
    event TimeoutRefunded(uint256 indexed purchaseId, address indexed buyer, uint256 amountRefunded);
    event DisputeRaised(uint256 indexed purchaseId, address indexed buyer, string reason);
    event DisputeResolved(uint256 indexed purchaseId, bool indexed buyerWins, string details);
    event ClaimResolved(uint256 indexed listingId, address indexed seller, bool claimWasAccurate);
    event ArbitratorUpdated(address indexed newArbitrator);

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "Only arbitrator can perform this action");
        _;
    }

    constructor(address _arbitrator) {
        require(_arbitrator != address(0), "Invalid arbitrator address");
        arbitrator = _arbitrator;
    }

    // --- STAKING MANAGEMENT ---

    /**
     * @notice Deposit stake into the seller registry to build skin in the game.
     */
    function depositStake() external payable {
        require(msg.value > 0, "Deposit amount must be > 0");
        sellerReputations[msg.sender].stake += msg.value;
        emit StakeDeposited(msg.sender, msg.value, sellerReputations[msg.sender].stake);
    }

    /**
     * @notice Withdraw unencumbered stake from the registry.
     */
    function withdrawStake(uint256 amount) external {
        SellerReputation storage rep = sellerReputations[msg.sender];
        require(rep.stake >= amount, "Insufficient stake balance");
        rep.stake -= amount;
        payable(msg.sender).transfer(amount);
        emit StakeWithdrawn(msg.sender, amount, rep.stake);
    }

    // --- LISTING MANAGEMENT ---

    /**
     * @notice Create a scouting intelligence listing on-chain.
     */
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
        require(bytes(teaser).length > 0, "Teaser cannot be empty");
        require(expiryTimestamp > block.timestamp, "Expiry must be in the future");
        if (category == ClaimCategory.Falsifiable) {
            require(claimResolutionTimestamp > block.timestamp, "Resolution date must be in the future");
        }

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

        sellerListings[msg.sender].push(listingId);

        emit ListingCreated(
            listingId,
            msg.sender,
            contentCommitment,
            teaser,
            price,
            expiryTimestamp,
            category,
            claimResolutionTimestamp
        );
    }

    // --- PURCHASE & ESCROW ---

    /**
     * @notice Buy a scouting report by locking payment in escrow.
     */
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
            revealedContent: "",
            disputedAt: 0,
            disputeReason: ""
        });

        buyerPurchases[msg.sender].push(purchaseId);

        emit IntelPurchased(purchaseId, listingId, msg.sender, msg.value, revealDeadline);
    }

    // --- COMMIT-REVEAL & SETTLEMENT ---

    /**
     * @notice Seller reveals the plaintext intel / decryption key, verified on-chain against hash commitment.
     */
    function revealIntel(uint256 purchaseId, string calldata revealedContent) external {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];

        require(msg.sender == listing.seller, "Only seller can reveal intel");
        require(purchase.status == PurchaseStatus.PendingReveal, "Purchase not pending reveal");
        require(block.timestamp <= purchase.revealDeadline, "Reveal deadline passed");

        // Proof of reveal: keccak256 hash match check
        bytes32 computedHash = keccak256(abi.encodePacked(revealedContent));
        require(computedHash == listing.contentCommitment, "Commitment hash mismatch! Delivered content does not match commitment.");

        purchase.status = PurchaseStatus.Revealed;
        purchase.revealedContent = revealedContent;

        emit IntelRevealed(purchaseId, revealedContent);
    }

    /**
     * @notice Buyer claims full refund if seller fails to reveal within the reveal window.
     */
    function claimTimeoutRefund(uint256 purchaseId) external {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];

        require(msg.sender == purchase.buyer, "Only buyer can claim refund");
        require(purchase.status == PurchaseStatus.PendingReveal, "Purchase not pending reveal");
        require(block.timestamp > purchase.revealDeadline, "Reveal deadline has not passed");

        purchase.status = PurchaseStatus.Refunded;

        // Refund buyer
        uint256 refundAmount = purchase.amountPaid;
        purchase.amountPaid = 0;
        payable(purchase.buyer).transfer(refundAmount);

        // Penalize seller stake if available
        SellerReputation storage sellerRep = sellerReputations[listing.seller];
        uint256 penalty = sellerRep.stake >= slashAmount ? slashAmount : sellerRep.stake;
        if (penalty > 0) {
            sellerRep.stake -= penalty;
            // Transfer penalty to buyer as liquidated damages
            payable(purchase.buyer).transfer(penalty);
        }

        emit TimeoutRefunded(purchaseId, purchase.buyer, refundAmount + penalty);
    }

    /**
     * @notice Buyer confirms receipt of revealed intel, releasing escrow funds to seller.
     */
    function confirmReceipt(uint256 purchaseId) external {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];

        require(msg.sender == purchase.buyer, "Only buyer can confirm receipt");
        require(purchase.status == PurchaseStatus.Revealed, "Purchase must be in Revealed state");

        purchase.status = PurchaseStatus.Confirmed;

        uint256 payout = purchase.amountPaid;
        purchase.amountPaid = 0;

        // Update seller statistics
        SellerReputation storage sellerRep = sellerReputations[listing.seller];
        sellerRep.completedSales++;
        sellerRep.totalEarnings += payout;

        payable(listing.seller).transfer(payout);

        emit PurchaseConfirmed(purchaseId, listing.seller, payout);
    }

    // --- DISPUTE RESOLUTION ---

    /**
     * @notice Buyer raises a dispute post-reveal (hash mismatch/misrepresentation) or pending reveal.
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
     * @notice Arbitrator resolves a dispute, distributing escrow funds and slashing/refunding bonds.
     */
    function resolveDispute(uint256 purchaseId, bool buyerWins, string calldata details) external onlyArbitrator {
        Purchase storage purchase = purchases[purchaseId];
        Listing storage listing = listings[purchase.listingId];

        require(purchase.status == PurchaseStatus.Disputed, "Purchase is not in disputed state");

        SellerReputation storage sellerRep = sellerReputations[listing.seller];

        if (buyerWins) {
            purchase.status = PurchaseStatus.Refunded;
            sellerRep.disputesLost++;

            // Refund buyer: escrowed amount + buyer's dispute bond
            uint256 totalRefund = purchase.amountPaid + disputeBond;
            purchase.amountPaid = 0;

            // Slash seller stake if available
            uint256 penalty = sellerRep.stake >= slashAmount ? slashAmount : sellerRep.stake;
            if (penalty > 0) {
                sellerRep.stake -= penalty;
                totalRefund += penalty; // Award slashed stake to buyer as compensation
            }

            payable(purchase.buyer).transfer(totalRefund);

        } else {
            purchase.status = PurchaseStatus.Confirmed;
            sellerRep.disputesWon++;
            sellerRep.completedSales++;

            // Release escrow + buyer's forfeited dispute bond to seller
            uint256 totalPayout = purchase.amountPaid + disputeBond;
            purchase.amountPaid = 0;
            sellerRep.totalEarnings += totalPayout;

            payable(listing.seller).transfer(totalPayout);
        }

        emit DisputeResolved(purchaseId, buyerWins, details);
    }

    // --- FALSIFIABLE CLAIM VERIFICATION ---

    /**
     * @notice Arbitrator / Resolution Oracle verifies a falsifiable claim outcome post-resolution date.
     */
    function resolveFalsifiableClaim(uint256 listingId, bool claimWasAccurate) external onlyArbitrator {
        Listing storage listing = listings[listingId];
        require(listing.category == ClaimCategory.Falsifiable, "Only falsifiable claims can be resolved");
        require(block.timestamp >= listing.claimResolutionTimestamp, "Resolution date not reached yet");

        SellerReputation storage sellerRep = sellerReputations[listing.seller];
        sellerRep.resolvedClaims++;
        if (claimWasAccurate) {
            sellerRep.accurateClaims++;
        }

        emit ClaimResolved(listingId, listing.seller, claimWasAccurate);
    }

    // --- REPUTATION READ FUNCTIONS & DECISION ENGINE ---

    /**
     * @notice Get comprehensive seller reputation statistics.
     */
    function getSellerReputation(address seller)
        external
        view
        returns (
            uint256 stake,
            uint256 completedSales,
            uint256 disputesWon,
            uint256 disputesLost,
            uint256 resolvedClaims,
            uint256 accurateClaims,
            uint256 totalEarnings,
            uint256 compositeScoreBps
        )
    {
        SellerReputation memory rep = sellerReputations[seller];
        uint256 score = calculateReputationScore(seller);
        return (
            rep.stake,
            rep.completedSales,
            rep.disputesWon,
            rep.disputesLost,
            rep.resolvedClaims,
            rep.accurateClaims,
            rep.totalEarnings,
            score
        );
    }

    /**
     * @notice Compute seller reputation score from 0 to 10000 basis points (0% - 100%).
     * @dev Weighs completed sales, dispute accuracy ratio, falsifiable claim accuracy, and stake.
     */
    function calculateReputationScore(address seller) public view returns (uint256 scoreBps) {
        SellerReputation memory rep = sellerReputations[seller];

        // New sellers start with baseline score of 5000 bps (50%) if minimum stake deposited
        if (rep.completedSales == 0 && rep.resolvedClaims == 0) {
            return rep.stake >= minSellerStake ? 5000 : 2500;
        }

        uint256 disputeScore = 10000;
        uint256 totalDisputes = rep.disputesWon + rep.disputesLost;
        if (totalDisputes > 0) {
            disputeScore = (rep.disputesWon * 10000) / totalDisputes;
        }

        uint256 accuracyScore = 10000;
        if (rep.resolvedClaims > 0) {
            accuracyScore = (rep.accurateClaims * 10000) / rep.resolvedClaims;
        }

        // Weighted average: 40% dispute win rate, 40% claim accuracy, 20% volume/stake factor
        uint256 volumeFactor = rep.completedSales > 10 ? 10000 : rep.completedSales * 1000;

        scoreBps = (disputeScore * 40 + accuracyScore * 40 + volumeFactor * 20) / 100;
    }

    /**
     * @notice Decision engine helper function for buyer agents to evaluate a listing.
     */
    function evaluateListing(uint256 listingId)
        external
        view
        returns (
            bool isValid,
            bool canPurchase,
            uint256 sellerScoreBps,
            uint256 sellerStake,
            uint256 price
        )
    {
        Listing memory listing = listings[listingId];
        if (listing.listingId == 0 || !listing.active) {
            return (false, false, 0, 0, 0);
        }

        bool isExpired = block.timestamp > listing.expiryTimestamp;
        canPurchase = !isExpired;
        sellerStake = sellerReputations[listing.seller].stake;
        sellerScoreBps = calculateReputationScore(listing.seller);
        price = listing.price;
        isValid = true;
    }

    /**
     * @notice Admin function to update arbitrator address.
     */
    function setArbitrator(address newArbitrator) external onlyArbitrator {
        require(newArbitrator != address(0), "Invalid arbitrator address");
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(newArbitrator);
    }
}
