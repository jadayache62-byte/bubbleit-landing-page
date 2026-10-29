import assert from 'node:assert/strict';
import test from 'node:test';
import {exactWalletMinor,validateFundingReview} from '../lib/api/funding-types.ts';
import type {FundingReview} from '../lib/api/funding-types.ts';
const review: FundingReview = {purchase_id:1,subject_type:'booking',subject_id:2,subject_reference:'BI-QA-0001',amount_minor:10000,currency:'QAR',status:'pending',review_path:'/account/payments/1',wallet:{currency:'QAR',balance_minor:10000,reserved_minor:3000,available_minor:7000,as_of:'2026-10-26T10:00:00Z',capabilities:{can_spend:true}},external_channels:['skipcash_hosted'],funding:{id:3,status:'awaiting_remainder',wallet_amount_minor:3000,external_amount_minor:7000,external_channel:'bank_transfer',expires_at:'2026-10-26T10:15:00Z',checkout_url:null}};
test('purchase review preserves exact full total and rejects conflicting funding or owner-wallet amounts',()=>{
  assert.equal(validateFundingReview(review).amount_minor,10000);
  for (const patch of [{amount_minor:7000},{currency:'USD'},{review_path:'https://example.test'},{wallet:{...review.wallet,available_minor:10000}},{funding:{...review.funding,external_amount_minor:7001}},{funding:{...review.funding,external_channel:null}}]) {
    assert.throws(()=>validateFundingReview({...review,...patch} as FundingReview));
  }
});
test('wallet input has exact QAR precision and cannot round fractions or accept exponent notation',()=>{
  assert.equal(exactWalletMinor('30'),3000);assert.equal(exactWalletMinor('30.01'),3001);
  for (const value of ['0','-1','30.001','1e2','30,00','NaN',' 30','9007199254740991']) assert.equal(exactWalletMinor(value),null);
});

test('new customer remainder choices are card only while historical manual plans remain readable',()=>{
  assert.equal(validateFundingReview(review).funding?.external_channel,'bank_transfer');
  for(const channel of ['cash','bank_transfer','skipcash_qpay','paylater']) assert.throws(()=>validateFundingReview({...review,external_channels:[channel]} as FundingReview));
});
