/** Read-only first-party unsigned x402-v2 quote preflight; never pays. */
import { OFFER, inspectUnpaidQuote } from "../src/guard.mjs";
try {
  const terms = await inspectUnpaidQuote(fetch);
  console.log(JSON.stringify({
    vendor: "Blockchain IQ",
    resource: OFFER.url,
    unsignedHTTP: 402,
    x402Version: terms.x402Version,
    paymentNetwork: terms.chain,
    nativeCircleBaseUSDC: terms.priceUSDC,
    token: terms.token,
    recipient: terms.payTo,
    signed: false,
    spentUSDC: "0.000000",
    actualPaidCall: false,
    independentlyProvenTransaction: null,
    note: "This is a public 402 price verification only, not the paid call required to claim a bounty."
  }, null, 2));
} catch (err) {
  console.error("Read-only quote not verified:", err.code || err.message);
  process.exitCode = 2;
}
