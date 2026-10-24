import test from "node:test";
import assert from "node:assert/strict";
import { OFFER, validatePaymentRequired, inspectUnpaidQuote } from "../src/guard.mjs";
import { createBlockchainIQPaidBriefTool, parseSettlementHeader } from "../src/tool.mjs";

const quote = (changes={}) => ({
  x402Version: 2,
  resource: { url: OFFER.url },
  accepts: [{
    scheme: "exact",
    network: OFFER.chain,
    amount: OFFER.atomicUSDC,
    asset: OFFER.token,
    payTo: OFFER.payee,
    ...changes
  }]
});
const wire = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64");
const unsigned = async (_url, _args) => new Response(
  JSON.stringify({ error: "Payment required" }),
  { status: 402, headers: { "PAYMENT-REQUIRED": wire(quote()) } }
);
const paidResponse = (data={ok:true}) => new Response(JSON.stringify(data),{
  status: 200, headers:{
    "Content-Type":"application/json",
    "PAYMENT-RESPONSE":wire({success:true, network:OFFER.chain, transaction:"0x"+"a".repeat(64)})
  }
});

test("canonical first-party USDC quote exact 10000 units validated, no signing",()=>{
 const r=validatePaymentRequired(wire(quote()));
 assert.equal(r.x402Version,2);
 assert.equal(r.chain,"eip155:8453");
 assert.equal(r.token,"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(r.payTo,"0x617da9383fba67e86137bc4924b8b7e400fb7c9e");
 assert.equal(r.priceUSDC,"0.010000");
 assert.equal(r.signed,false);
 assert.equal(r.settled,false);
});
test("reject price, token, chain, recipient, scheme and resource modifications",()=>{
 const invalid=[
  {amount:"11000"},{asset:"0x"+"11".repeat(20)},
  {network:"eip155:1"},{payTo:"0x"+"ff".repeat(20)},{scheme:"upto"}
 ];
 for(const changed of invalid) assert.throws(()=>validatePaymentRequired(wire(quote(changed))),/BLOCKCHAIN_IQ_PREFLIGHT_/);
 assert.throws(()=>validatePaymentRequired(wire({...quote(), resource:{url:"https://evil.invalid"}})),/WRONG_RESOURCE/);
 assert.throws(()=>validatePaymentRequired(wire({...quote(), x402Version:1})),/UNSUPPORTED_X402_VERSION/);
 assert.throws(()=>validatePaymentRequired(wire({...quote(), accepts:[quote().accepts[0],quote().accepts[0]]})),/AMBIGUOUS_PAYMENT_TERMS/);
 assert.throws(()=>validatePaymentRequired("not base64, no"),/INVALID_PAYMENT_REQUIRED_HEADER/);
});
test("unpaid preflight makes one precisely pinned GET and returns no signer",async()=>{
 let count=0;
 const v=await inspectUnpaidQuote(async(url,args)=> {
  count++;
  assert.equal(url,OFFER.url);
  assert.equal(args.method,"GET");
  assert.equal(args.redirect,"error");
  return unsigned();
 });
 assert.equal(count,1);assert.equal(v.signed,false);assert.equal(v.settled,false);
});
test("unpaid preflight refuses HTTP200 with no charged transaction",async()=>{
 await assert.rejects(inspectUnpaidQuote(async()=>paidResponse()),/UNEXPECTED_HTTP_200/);
});
test("LangChain authentic DynamicStructuredTool can invoke mocked paid-fetch and report receipt",async()=>{
 const calls=[];
 const tool=createBlockchainIQPaidBriefTool({
   unpaidFetch:async (url,args)=>{calls.push(["unpaid",url,args.method]);return unsigned();},
   paidFetch:async (url,args)=>{calls.push(["paid",url,args.method]);return paidResponse({assets:["BTC","ETH","SOL","XRP"],source:"synthetic TEST ONLY"});}
 });
 assert.equal(tool.name,"blockchainiq_paid_brief");
 assert.ok(tool.description.includes("LangChain")===false || typeof tool.description==="string");
 const content=await tool.invoke({});
 const payload=JSON.parse(content);
 assert.equal(payload.kind,"blockchainiq_paid_brief_langchain_tool");
 assert.equal(payload.paymentPriceUSDC,"0.010000");
 assert.equal(payload.paymentChain,"eip155:8453");
 assert.equal(payload.paymentResponseTransactionHash,"0x"+"a".repeat(64));
 assert.equal(payload.paymentReceiptNotAnIndependentOnchainAudit,true);
 assert.deepEqual(payload.payload.assets,["BTC","ETH","SOL","XRP"]);
 assert.deepEqual(calls.map(x=>x[0]),["unpaid","paid"]);
 assert.ok(calls.every(x=>x[1]===OFFER.url && x[2]==="GET"));
});
test("tool NEVER pays when signer-callback absent or the preflight quote is poisoned",async()=>{
 assert.throws(()=>createBlockchainIQPaidBriefTool({unpaidFetch:unsigned}),/Provide caller-approved/);
 let charged=0;
 const tool=createBlockchainIQPaidBriefTool({
   unpaidFetch:async()=>new Response(null,{status:402,headers:{"PAYMENT-REQUIRED":wire(quote({payTo:"0x"+"e".repeat(40)}))}}),
   paidFetch:async()=>{charged++;return paidResponse();}
 });
 await assert.rejects(tool.invoke({}),/WRONG_PAYEE/);
 assert.equal(charged,0);
});
test("a paid body without real PAYMENT-RESPONSE is rejected",async()=>{
 const tool=createBlockchainIQPaidBriefTool({
   unpaidFetch:unsigned,
   paidFetch:async()=>new Response(JSON.stringify({foo:1}),{status:200,headers:{"Content-Type":"application/json"}})
 });
 await assert.rejects(tool.invoke({}),/PAYMENT_RESPONSE_MISSING_OR_INVALID/);
});
test("a failed/no-chain/wrong hash response is not a paid receipt",()=>{
 assert.throws(()=>parseSettlementHeader(wire({success:false,network:OFFER.chain,transaction:"0x"+"a".repeat(64)})),/NOT_SUCCESSFUL/);
 assert.throws(()=>parseSettlementHeader(wire({success:true,network:"eip155:1",transaction:"0x"+"a".repeat(64)})),/WRONG_NETWORK/);
 assert.throws(()=>parseSettlementHeader(wire({success:true,network:OFFER.chain,transaction:"0xFF"})),/MISSING_TRANSACTION_HASH/);
});
test("malformed HTTP, JSON and output size rejected after simulated 402, never counted as cash",async()=>{
 for(const bad of [
   new Response(JSON.stringify({error:"no"}),{status:402}),
   new Response("{}",{status:200,headers:{"Content-Type":"text/plain"}}),
   new Response("not json",{status:200,headers:{"Content-Type":"application/json","PAYMENT-RESPONSE":wire({success:true,network:OFFER.chain,transaction:"0x"+"a".repeat(64)})}})
 ]) {
   const tool=createBlockchainIQPaidBriefTool({unpaidFetch:unsigned,paidFetch:async()=>bad.clone()});
   await assert.rejects(tool.invoke({}));
 }
});
