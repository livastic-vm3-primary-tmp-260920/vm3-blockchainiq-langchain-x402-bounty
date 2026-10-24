/**
 * First-party exact quote allowlist: Blockchain IQ official Base USDC paid brief.
 * Unauthenticated preflight only. NO private key, wallet, signature or payment.
 * https://www.blockchainiq.co/blog/x402-build-bounties
 */
export const OFFER = Object.freeze({
  origin: "https://www.blockchainiq.co",
  path: "/api/x402/v1/brief",
  chain: "eip155:8453",
  token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  payee: "0x617da9383fba67e86137bc4924b8b7e400fb7c9e",
  atomicUSDC: "10000",
  priceUSDC: "0.010000",
  url: "https://www.blockchainiq.co/api/x402/v1/brief"
});
function fail(reason) {
  const err = new Error("BLOCKCHAIN_IQ_PREFLIGHT_" + reason);
  err.code = "BLOCKCHAIN_IQ_PREFLIGHT_" + reason;
  throw err;
}
function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}
export function validatePaymentRequired(wire, resourceUrl = OFFER.url) {
  if (resourceUrl !== OFFER.url) fail("UNTRUSTED_RESOURCE_URL");
  if (typeof wire !== "string" || wire.length === 0 || wire.length > 24000 ||
      !/^[A-Za-z0-9+/=_-]+$/.test(wire)) fail("INVALID_PAYMENT_REQUIRED_HEADER");
  let message;
  try {
    message = JSON.parse(Buffer.from(wire, "base64").toString("utf8"));
  } catch {
    fail("MALFORMED_PAYMENT_REQUIRED_PAYLOAD");
  }
  if (message?.x402Version !== 2) fail("UNSUPPORTED_X402_VERSION");
  const accepts = message?.accepts;
  if (!Array.isArray(accepts) || accepts.length !== 1) fail("AMBIGUOUS_PAYMENT_TERMS");
  const a = accepts[0];
  if (a?.scheme !== "exact") fail("UNSUPPORTED_PAYMENT_SCHEME");
  if (a?.network !== OFFER.chain) fail("WRONG_NETWORK");
  if (a?.amount !== OFFER.atomicUSDC) fail("WRONG_PRICE");
  if (!isAddress(a?.asset) || a.asset.toLowerCase() !== OFFER.token) fail("WRONG_TOKEN");
  if (!isAddress(a?.payTo) || a.payTo.toLowerCase() !== OFFER.payee) fail("WRONG_PAYEE");
  // The resource field may be omitted; if present, match the exact pinned URL.
  if (message?.resource?.url && message.resource.url !== resourceUrl) fail("WRONG_RESOURCE");
  return Object.freeze({
    x402Version: 2,
    chain: OFFER.chain,
    payTo: OFFER.payee,
    token: OFFER.token,
    atomicUSDC: OFFER.atomicUSDC,
    priceUSDC: OFFER.priceUSDC,
    resourceUrl,
    signed: false,
    settled: false
  });
}
export async function inspectUnpaidQuote(
  unpaidFetch = globalThis.fetch,
  resourceUrl = OFFER.url
) {
  if (typeof unpaidFetch !== "function") fail("MISSING_UNPAID_FETCH");
  if (resourceUrl !== OFFER.url) fail("UNTRUSTED_RESOURCE_URL");
  const result = await unpaidFetch(resourceUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "error"
  });
  if (result.status !== 402) fail("UNEXPECTED_HTTP_" + result.status);
  return validatePaymentRequired(result.headers.get("PAYMENT-REQUIRED"), resourceUrl);
}
