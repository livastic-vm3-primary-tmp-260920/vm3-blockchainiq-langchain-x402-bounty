/**
 * IMPORTANT: manual optional paid integration test, not run in CI.
 *
 * This is intended for the original independent bounty operator's throwaway
 * funded wallet / an explicitly authorized human tester ONLY. The owner AI
 * agent is forbidden to run this with the original VM1/VM5 wallets.
 *
 * EXACT max charge: 0.01 native Circle USDC on Base. No user keys bundled.
 * Never asks the caller to top up gas: standard exact x402 settlement is
 * gas-sponsored by the facilitator, though the buyer spends USDC.
 */
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createBlockchainIQPaidBriefTool } from "../src/tool.mjs";
import { OFFER } from "../src/guard.mjs";

const VM1_PAYEE = "0x4e3106520e40af30870cafe78da1b1e7110ed98e";
const VM5_PAYEE = "0x6b01efa0705e91a7aca54271510bf9e594717f34";

if (process.env.BIQ_THROWAWAY_PAYMENT_TEST !== "HUMAN_AUTHORIZE_0_01_USDC") {
  console.error("SKIPPED: throwaway wallet paid test is disabled by default.");
  console.error("No wallet, chain, signing, transaction or money was used.");
  process.exit(3);
}
const key = process.env.BIQ_TEST_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  throw new Error("Use a separately owner-approved disposable funded wallet; never paste original wallet private keys.");
}
const account = privateKeyToAccount(key);
if ([VM1_PAYEE, VM5_PAYEE, OFFER.payee].includes(account.address.toLowerCase())) {
  throw new Error("Original real owner wallet / vendor wallet NOT allowed as test payer.");
}
if (process.env.BIQ_MAX_PER_PAYMENT_USDC !== "0.01") {
  throw new Error("Exact maximum payment 0.01 USDC must be explicitly set.");
}
const client = x402Client.fromConfig({
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
  spendControls: { maxAmountPerPayment: 0.01 }
});
const paidFetch = wrapFetchWithPayment(fetch, client);
const tool = createBlockchainIQPaidBriefTool({ unpaidFetch: fetch, paidFetch });
const output = JSON.parse(await tool.invoke({}));
if (!output.paymentResponseTransactionHash) {
  throw new Error("No actual payment response transaction hash returned");
}
console.log(JSON.stringify({
  integration: "LangChain official Blockchain IQ paid brief",
  originalBountyCandidate: "https://www.blockchainiq.co/blog/x402-build-bounties",
  x402Vendor: OFFER.origin,
  paidResource: OFFER.url,
  priceUSDC: OFFER.priceUSDC,
  chain: OFFER.chain,
  transactionHash: output.paymentResponseTransactionHash,
  note: "Verify this transaction independently before claiming a bounty; this does not prove acceptance by the sponsor."
}, null, 2));
