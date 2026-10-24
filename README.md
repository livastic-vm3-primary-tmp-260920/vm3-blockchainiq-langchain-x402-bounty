# Blockchain IQ paid brief — independent LangChain x402 adapter

An original AI-assisted LangChain DynamicStructuredTool for the official Blockchain IQ $525 USDC framework integration bounty announced 23 October 2026:
https://www.blockchainiq.co/blog/x402-build-bounties

**Current status: original runnable source and mocked integration tests completed. A REAL paid API purchase has NOT been made. No prize has been claimed or earned.**

## What it does

The LangChain tool named blockchainiq_paid_brief requests Blockchain IQ's real brief endpoint via a buyer-supplied, x402-wrapped fetch function. It first validates the unauthenticated HTTP 402 payment challenge against a strict allowlist: the exact API URL, the Base network, genuine native Circle USDC contract, 10,000 atomic USDC units (0.01 USDC), and the original blockchainiq seller's own public payee. Any drift fails closed BEFORE the wallet-wrapped callback can be used.

A paid HTTP 200 response must carry valid JSON and a PAYMENT-RESPONSE header with successful Base network settlement and 0x-prefixed transaction hash. The tool returns JSON suitable for LangChain agents. It does not trade, sign transactions internally, access customer private keys, assert finality without verification or provide personalized investment advice.

Implementation files:
- src/guard.mjs: x402 v2 unsigned challenge validation and exact seller allowlist.
- src/tool.mjs: LangChain DynamicStructuredTool with injected customer-authorized payment callback.
- tests/tool.test.mjs: offline positive/negative cases.
- scripts/free-preflight.mjs: optional actual HTTP 402 check with NO payment.
- scripts/manual-paid-smoke.mjs: disabled by default; optional human-only test using a disposable wallet, NOT executed here.

## Setup and offline tests

Node.js 22+ is supported. In this project directory:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run check
    npm test

The automated tests use only local fake HTTP responses. No wallet is created; no token transaction or signature is generated. Fixture transaction hashes MUST NEVER be used to claim a bounty.

To inspect the real unsigned public payment quote (no money movement):

    node scripts/free-preflight.mjs

## Embedding in a LangChain agent

Your application provides a separately authorized x402 payment-enabled fetch callback. This module never loads wallet secrets.

    import { createBlockchainIQPaidBriefTool } from "./src/tool.mjs";
    const tool = createBlockchainIQPaidBriefTool({ paidFetch });
    const result = JSON.parse(await tool.invoke({}));
    console.log(result.paymentResponseTransactionHash, result.payload);

The caller must determine an actual funded, permitted wallet and a separate payment budget before injecting paidFetch.

## First-party seller terms validated 25 October 2026

- Real endpoint: https://www.blockchainiq.co/api/x402/v1/brief
- Method: GET. A request without payment returns HTTP 402.
- Protocol: x402 version 2 exact scheme.
- Network: eip155:8453 (Base).
- Real token: native Circle Base USDC, contract 0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913.
- Real price: 10,000 atomic units = 0.010000 USDC.
- Seller recipient: 0x617dA9383fbA67e86137BC4924b8b7E400fB7C9e.
- Output: fresh market data on BTC, ETH, SOL and XRP, not financial advice.
- Official free catalog: https://www.blockchainiq.co/api/x402/v1

Price, recipient, network or token changes stop the tool. Never silently rewrite financial limits to pass a seller challenge.

## Independent human / sponsor throwaway paid smoke ONLY

The advertised framework bounty requires a genuine paid call and a real x402 settlement hash, before a developer may submit the prize claim. Blockchain IQ says it validates the wallet and hash against its purchase log, audits source/dependencies, and independently executes the integration with a throwaway funded wallet. Therefore code-only or mock-only evidence is not a valid prize claim.

The optional script is deliberately disabled by default, and refuses original VM1/VM5 merchant wallets as PAYERS. A specifically authorized HUMAN or the sponsor in their isolated test environment may choose to use it with a separate disposable wallet, with ALL required environment variables supplied directly and never committed:

    BIQ_THROWAWAY_PAYMENT_TEST=HUMAN_AUTHORIZE_0_01_USDC
    BIQ_MAX_PER_PAYMENT_USDC=0.01
    BIQ_TEST_PRIVATE_KEY=<a-separately-approved-disposable-funded-wallet-private-key>
    npm run manual:paid

THIS AUTOMATED ASSISTANT MUST NOT RUN THE PAID COMMAND under the established original owner wallet-signing and spending restrictions. No private key is included in this repository. The x402 protocol may sponsor network gas but still spends the wallet's real 0.01 USDC. A PAYMENT-RESPONSE header is not independent onchain finality; verify any real transaction separately. This paragraph describes an optional implementation pathway, not a request to provide secrets into chat.

## Original owner and award disclosure

One accountable real human operates the original VM1 and VM3 properties. The original VM1 MetaMask public EVM recipient is 0x4e3106520E40af30870caFE78da1B1e7110eD98E; it is a possible prize payout RECEIVE-ONLY address, not the buyer wallet or a funding source. No other beneficial owners, duplicate authors, self-purchases or private account claims are used.

The advertised bounty is conditional: four framework slots (LangChain, Coinbase AgentKit, ElizaOS, CrewAI/Cloudflare), first accepted completion 150 USDC and three later accepted completions 125 USDC each, until 31 December 2026 (US Central). One developer may claim no more than two distinct slots. Real code, one paid transaction, direct claim email and independent verification are required. The vendor says the original payer is paid Base native Circle USDC within 3 days AFTER claim passes. There is no guaranteed slot or reward for publishing this source.

**This repository was developed with AI help, tested offline without real spending, and is NOT YET BOUNTY-ELIGIBLE under the published paid-transaction requirement.**
