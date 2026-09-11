import json
import os
from web3 import Web3

class PythonSellerAgent:
    def __init__(self, w3, signer_account, contract_address, abi):
        self.w3 = w3
        self.account = signer_account
        self.contract = w3.eth.contract(address=contract_address, abi=abi)

    def ensure_stake(self, min_stake_eth=0.01):
        min_stake_wei = self.w3.to_wei(min_stake_eth, 'ether')
        rep = self.contract.functions.getSellerReputation(self.account.address).call()
        current_stake = rep[0]
        print(f"[Python Seller Agent] Current Stake: {self.w3.from_wei(current_stake, 'ether')} ETH")

        if current_stake < min_stake_wei:
            needed = min_stake_wei - current_stake
            print(f"[Python Seller Agent] Depositing {self.w3.from_wei(needed, 'ether')} ETH stake...")
            tx = self.contract.functions.depositStake().build_transaction({
                'from': self.account.address,
                'value': needed,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            self.w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"[Python Seller Agent] Stake deposit confirmed. Tx: {tx_hash.hex()}")

    def create_listing(self, teaser, plaintext, price_eth, expiry_hours=24, category="Falsifiable", resolution_days=7):
        price_wei = self.w3.to_wei(price_eth, 'ether')
        commitment_hash = self.w3.solidity_keccak(['string'], [plaintext])
        
        # Current block timestamp
        latest_block = self.w3.eth.get_block('latest')
        now = latest_block['timestamp']
        expiry = now + expiry_hours * 3600
        resolution = now + resolution_days * 86400

        print(f"[Python Seller Agent] Posting listing: '{teaser}'")
        tx = self.contract.functions.createListing(
            commitment_hash,
            teaser,
            price_wei,
            expiry,
            0 if category == "Falsifiable" else 1,
            resolution
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gas': 300000,
            'gasPrice': self.w3.eth.gas_price
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"[Python Seller Agent] Listing created on-chain! Tx: {tx_hash.hex()}")
        return tx_hash.hex(), commitment_hash

    def reveal_intel(self, purchase_id, plaintext):
        print(f"[Python Seller Agent] Revealing intel for Purchase #{purchase_id}...")
        tx = self.contract.functions.revealIntel(purchase_id, plaintext).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gas': 300000,
            'gasPrice': self.w3.eth.gas_price
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"[Python Seller Agent] Proof-of-reveal submitted! Tx: {tx_hash.hex()}")
        return tx_hash.hex()
