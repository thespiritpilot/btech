import requests
import json

def try_faucets(address):
    print(f"Attempting to request testnet ETH for {address}...")
    
    # Try Base Sepolia / Sepolia faucets
    endpoints = [
        ("Base Sepolia (Superchain Faucet API)", "https://faucet.triangleplatform.com/base/sepolia", {"address": address}),
        ("Sepolia Faucet", "https://faucet.pk910.de/", None),
        ("Quicknode", f"https://faucet.quicknode.com/base/sepolia", None)
    ]
    
    for name, url, payload in endpoints:
        try:
            if payload:
                r = requests.post(url, json=payload, timeout=10)
                print(f"[{name}] response {r.status_code}: {r.text[:200]}")
            else:
                r = requests.get(url, timeout=10)
                print(f"[{name}] status {r.status_code}")
        except Exception as e:
            print(f"[{name}] error: {e}")

if __name__ == "__main__":
    with open(".env.testnet", "r") as f:
        pk = f.read().strip()
    from eth_account import Account
    acct = Account.from_key(pk)
    try_faucets(acct.address)
