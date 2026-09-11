import os
from web3 import Web3
from eth_account import Account

base_rpc = "https://sepolia.base.org"
sepolia_rpc = "https://ethereum-sepolia-rpc.publicnode.com"

w3_base = Web3(Web3.HTTPProvider(base_rpc))
w3_sep = Web3(Web3.HTTPProvider(sepolia_rpc))

print(f"Base Sepolia connected: {w3_base.is_connected()}")
print(f"Sepolia connected: {w3_sep.is_connected()}")

# Generate a fresh deployment key if not present
pk_file = ".env.testnet"
if os.path.exists(pk_file):
    with open(pk_file, "r") as f:
        pk = f.read().strip()
else:
    acct = Account.create()
    pk = acct.key.hex()
    with open(pk_file, "w") as f:
        f.write(pk)

acct = Account.from_key(pk)
print(f"Deployer address: {acct.address}")

bal_base = w3_base.eth.get_balance(acct.address)
bal_sep = w3_sep.eth.get_balance(acct.address)

print(f"Base Sepolia Balance: {w3_base.from_wei(bal_base, 'ether')} ETH")
print(f"Sepolia Balance: {w3_sep.from_wei(bal_sep, 'ether')} ETH")
