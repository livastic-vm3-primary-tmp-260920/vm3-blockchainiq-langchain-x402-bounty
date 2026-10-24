/**
 * LangChain v1 DynamicStructuredTool adapter for Blockchain IQ's actual x402 API.
 * Walletless at the module boundary: only caller-injected x402-wrapped fetch may
 * authorize a paid operation. This package never imports wallet secrets.
 */
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { OFFER, inspectUnpaidQuote } from "./guard.mjs";

export function parseSettlementHeader(encoded) {
  if (typeof encoded !== "string" || encoded.length < 8 || encoded.length > 10000) {
    throw new Error("PAYMENT_RESPONSE_MISSING_OR_INVALID");
  }
  let d;
  try {
    d = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("PAYMENT_RESPONSE_INVALID_JSON");
  }
  if (d?.success !== true) throw new Error("PAYMENT_RESPONSE_NOT_SUCCESSFUL");
  if (d.network !== OFFER.chain) throw new Error("PAYMENT_RESPONSE_WRONG_NETWORK");
  const tx = d.transaction ?? d.transactionHash ?? d.txHash;
  if (typeof tx !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tx)) {
    throw new Error("PAYMENT_RESPONSE_MISSING_TRANSACTION_HASH");
  }
  return Object.freeze({
    chain: OFFER.chain,
    transactionHash: tx,
    // This is a network-specific HTTP receipt, not an independent RPC proof.
    onchainFinalityIndependentlyChecked: false
  });
}
export function createBlockchainIQPaidBriefTool({
  unpaidFetch = globalThis.fetch,
  paidFetch
} = {}) {
  if (typeof unpaidFetch !== "function") throw new TypeError("unpaidFetch must be a function");
  if (typeof paidFetch !== "function") {
    throw new TypeError("Provide caller-approved wrapFetchWithPayment; no wallet is created here.");
  }
  return new DynamicStructuredTool({
    name: "blockchainiq_paid_brief",
    description: "Get a fresh paid Blockchain IQ brief on Bitcoin, Ethereum, Solana and XRP via the verified x402-v2 Base USDC 0.01 endpoint. A separately pre-authorized wallet/fetch is required. Never trades, guesses financial returns or signs anything inside this LangChain tool.",
    schema: z.object({}).strict(),
    func: async () => {
      // 402 preflight is independent, read-only and fails closed for wrong asset
      // (native Circle USDC), payee, amount, network or resource.
      const preflight = await inspectUnpaidQuote(unpaidFetch, OFFER.url);
      const response = await paidFetch(OFFER.url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error"
      });
      if (response.status !== 200) {
        throw new Error("PAID_BRIEF_WAS_NOT_DELIVERED_HTTP_" + response.status);
      }
      if (!(response.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
        throw new Error("PAID_BRIEF_CONTENT_TYPE_NOT_JSON");
      }
      const settlement = parseSettlementHeader(response.headers.get("PAYMENT-RESPONSE"));
      const body = await response.text();
      if (body.length > 300000) throw new Error("PAID_BRIEF_EXCEEDS_OUTPUT_LIMIT");
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error("PAID_BRIEF_MALFORMED_JSON");
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("PAID_BRIEF_UNEXPECTED_RESPONSE_SHAPE");
      }
      return JSON.stringify({
        kind: "blockchainiq_paid_brief_langchain_tool",
        source: OFFER.url,
        paymentPriceUSDC: preflight.priceUSDC,
        paymentChain: settlement.chain,
        paymentResponseTransactionHash: settlement.transactionHash,
        paymentReceiptNotAnIndependentOnchainAudit: true,
        payload: data,
        caveat: "Market/research data only, not personalized financial advice. HTTP payment header is not independent proof of token-transfer finality."
      });
    }
  });
}
