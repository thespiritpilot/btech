process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function testFetch() {
  const rpcs = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://1rpc.io/sepolia",
    "https://sepolia.drpc.org",
    "https://gateway.tenderly.co/public/sepolia",
    "https://endpoints.omniatech.io/v1/eth/sepolia/public"
  ];

  for (const url of rpcs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 })
      });
      const data = await res.json();
      console.log(`[OK] ${url} -> Block ${parseInt(data.result, 16)}`);
    } catch (e) {
      console.log(`[FAIL] ${url} -> ${e.message}`);
    }
  }
}

testFetch();
