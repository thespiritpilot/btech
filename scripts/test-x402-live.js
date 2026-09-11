process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const http = require("http");
const { app, getDeploymentInfo } = require("../agents/x402_server");

async function testX402Live() {
  console.log("=======================================================================");
  console.log("            SCOUTMARKET x402 AGENT PROTOCOL TEST (LIVE)                ");
  console.log("=======================================================================");

  const server = app.listen(4025, async () => {
    console.log("x402 Server started on port 4025");
    const info = getDeploymentInfo();
    console.log(`Target Contract Address: ${info.contractAddress}`);
    console.log(`Target Network:          ${info.network}`);

    // 1. Test public discovery endpoint
    console.log("\n>>> Step 1: Querying public intel discovery endpoint /api/intel/latest...");
    const resDiscovery = await fetch("http://127.0.0.1:4025/api/intel/latest");
    const jsonDiscovery = await resDiscovery.json();
    console.log("Discovery Response Status:", resDiscovery.status);
    console.log("Live Contract in Response:", jsonDiscovery.contractAddress);
    console.log("Active Listings:", jsonDiscovery.listings);

    // 2. Test Payment Required endpoint
    console.log("\n>>> Step 2: Agent querying restricted intel endpoint /api/intel/1...");
    const resIntel = await fetch("http://127.0.0.1:4025/api/intel/1");
    console.log("Response Status Code:", resIntel.status);
    const jsonIntel = await resIntel.json();
    console.log("x402 Header / Body Payload:", JSON.stringify(jsonIntel, null, 2));

    if (resIntel.status === 402 && jsonIntel.contractAddress === info.contractAddress) {
      console.log("\n✅ x402 PAYMENT-REQUIRED PROTOCOL SUCCESSFULLY VERIFIED AGAINST LIVE CONTRACT!");
    } else {
      console.error("\n❌ Mismatch in x402 response payload!");
    }

    server.close(() => {
      console.log("x402 Test server closed.");
      process.exit(0);
    });
  });
}

testX402Live().catch(console.error);
