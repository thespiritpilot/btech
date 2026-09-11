import json
from web3 import Web3

class PythonBuyerAgent:
    def __init__(self, w3, signer_account, contract_address, abi):
        self.w3 = w3
        self.account = signer_account
        self.contract = w3.eth.contract(address=contract_address, abi=abi)

    def evaluate_listing(self, listing_id):
        print(f"[Python Buyer Agent] Reading reputation & listing #{listing_id} on-chain...")
        eval_data = self.contract.functions.evaluateListing(listing_id).call()
        is_valid, can_purchase, seller_score, seller_stake, price = eval_data

        listing = self.contract.functions.listings(listing_id).call()
        seller_rep = self.contract.functions.getSellerReputation(listing[1]).call()

        print(f"[Python Buyer Agent] Teaser: '{listing[3]}'")
        print(f"[Python Buyer Agent] Price: {self.w3.from_wei(price, 'ether')} ETH")
        print(f"[Python Buyer Agent] Seller Stake: {self.w3.from_wei(seller_stake, 'ether')} ETH")
        print(f"[Python Buyer Agent] Seller Reputation Score: {seller_score} bps ({seller_score/100:.1f}%)")

        min_stake = self.w3.to_wei(0.01, 'ether')
        min_score = 2500

        if is_valid and can_purchase and seller_stake >= min_stake and seller_score >= min_score:
            print("[Python Buyer Agent] DECISION: APPROVED for Escrow Purchase!")
            return True, price, listing[2] # return should_buy, price, commitment
        else:
            print("[Python Buyer Agent] DECISION: REJECTED due to high risk / low stake")
            return False, price, listing[2]

    def buy_intel(self, listing_id, price_wei):
        print(f"[Python Buyer Agent] Locking payment into escrow for Listing #{listing_id}...")
        tx = self.contract.functions.buyIntel(listing_id).build_transaction({
            'from': self.account.address,
            'value': price_wei,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gas': 300000,
            'gasPrice': self.w3.eth.gas_price
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"[Python Buyer Agent] Payment locked in escrow contract. Tx: {tx_hash.hex()}")
        return tx_hash.hex()

    def confirm_receipt(self, purchase_id):
        print(f"[Python Buyer Agent] Confirming receipt for Purchase #{purchase_id}...")
        tx = self.contract.functions.confirmReceipt(purchase_id).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"[Python Buyer Agent] Escrow released to seller. Tx: {tx_hash.hex()}")
        return tx_hash.hex()
