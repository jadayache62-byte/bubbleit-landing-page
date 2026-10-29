import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync} from 'node:fs';
import {expect,test, type APIResponse} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type {PurchaseSubject} from '../../lib/api/funding-types';

async function json(response: APIResponse) {
  expect(response.status(), (await response.text()).slice(0,700)).toBeLessThan(300);
  return (await response.json()).data;
}
test('actual BFF and PostgreSQL: refund credit, every purchase, split card capture, recorded customer return and ownership', async ({page,playwright})=>{
  const fixture=JSON.parse(readFileSync(process.env.WALLET_E2E_FIXTURES_FILE ?? '/tmp/bubbleit-wallet-e2e-fixtures.json','utf8'));
  const staff=await playwright.request.newContext({baseURL:'http://127.0.0.1:8840/api/v1/',extraHTTPHeaders:{Authorization:`Bearer ${fixture.manager_token}`,Accept:'application/json'}});
  try {
    await json(await staff.post(`admin/inventory/items/${fixture.inventory_item_id}/adjust`, {headers:{'Idempotency-Key':'wallet-e2e-opening-stock'},data:{stock_location_id:fixture.stock_location_id,quantity:10,type:'add',reason_code:'opening_balance',notes:'Disposable QA opening inventory.'}}));
    await json(await staff.post(`admin/parking-stays/${fixture.subjects.parking_stay}/prepare-checkout`,{data:{final_amount:'100.00',override_reason:'Fixed QA charge.'}}));
    await json(await staff.post(`admin/payments/${fixture.origin_purchase_id}/cash-receipts`,{headers:{'Idempotency-Key':'wallet-e2e-origin'},data:{notes:'Isolated QA receipt.'}}));
    const initial={command_key:crypto.randomUUID(),subject_type:'booking',subject_id:fixture.origin_booking_id,amount:'1000.00',reason:'Isolated QA refund credit.',settlement_destination:'customer_wallet'};
    const credit=await json(await staff.post('admin/refunds/complete',{data:initial}));
    expect(credit.status).toBe('processed');
    const replay=await json(await staff.post('admin/refunds/complete',{data:initial})); expect(replay.id).toBe(credit.id);
    await page.route('https://payments.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Isolated card checkout</h1>'}));
    await page.goto('/account');
    const login = await page.request.post('/api/customer/auth/login',{data:fixture.owner,headers:{Origin:new URL(page.url()).origin}});
    await json(login);
    const wallet=await json(await page.request.get('/api/customer/wallet'));expect(wallet.balance_minor).toBe(100000);
    const cookies=await page.context().cookies();expect(cookies.find(c=>c.name==='bubbleit_customer_session')?.httpOnly).toBe(true);
    const purchases:number[]=[];
    for (const [type,id] of Object.entries(fixture.subjects)) {
      const review=await json(await page.request.post('/api/customer/purchase-funding/prepare',{data:{subject_type:type as PurchaseSubject,subject_id:id},headers:{Origin:new URL(page.url()).origin}}));
      purchases.push(review.purchase_id);
      await page.goto(review.review_path);
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('radio',{name:'Yes',exact:true}).check();
      await page.getByLabel('Wallet amount (QAR)').fill('100.00');
      await page.getByRole('dialog').getByRole('button',{name:'Complete payment',exact:true}).click();
      await expect(page.getByText('Payment confirmed',{exact:true})).toBeVisible();
      await page.reload();await expect(page.getByText('Payment confirmed',{exact:true})).toBeVisible();
    }
    const vehicle=await json(await page.request.post('/api/customer/vehicles',{headers:{Origin:new URL(page.url()).origin},data:{plate_number:'70009994',type:'sedan',make:'QA',model:'Sedan'}}));
    const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
    const options=await json(await page.request.get(`/api/customer/memberships/${fixture.subjects.membership}/booking-options?date=${date}&vehicle_id=${vehicle.id}&latitude=25.2854&longitude=51.5310`));
    expect(options.slots.length).toBeGreaterThan(0);expect(options.washes_available).toBe(4);
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(60000);
    for (const status of ['confirmed','preparing','out_for_delivery','delivered']) {
      await json(await staff.post(`admin/store-orders/${fixture.subjects.store_order}/status`,{data:{status,notes:'QA physical delivery.'}}));
    }
    await json(await staff.post(`admin/parking-stays/${fixture.subjects.parking_stay}/checkout`,{data:{}}));
    for (const type of ['store_order','parking_stay','membership']) {
      const returned = await json(await staff.post('admin/refunds/complete',{data:{command_key:crypto.randomUUID(),subject_type:type,subject_id:fixture.subjects[type],amount:'100.00',reason:'QA refund after paid domain journey.',settlement_destination:'original_payment'}}));
      expect(returned.status).toBe('processed');
    }
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    const refundedOrder = await json(await staff.get(`admin/store-orders/${fixture.subjects.store_order}`));
    expect(refundedOrder.status).toBe('refunded');expect(refundedOrder.payment_status).toBe('refunded');
    expect((await json(await staff.get(`admin/store-stock?stock_location_id=${fixture.stock_location_id}`))).data[0].available_quantity).toBe(9);
    const physicalReturn = {condition:'saleable',notes:'QA physical return received.'};
    await json(await staff.post(`admin/store-orders/${fixture.subjects.store_order}/returns`,{data:physicalReturn}));
    await json(await staff.post(`admin/store-orders/${fixture.subjects.store_order}/returns`,{data:physicalReturn}));
    expect((await json(await staff.get(`admin/store-stock?stock_location_id=${fixture.stock_location_id}`))).data[0].available_quantity).toBe(10);
    const split=await json(await page.request.post('/api/customer/purchase-funding/prepare',{data:{subject_type:'booking',subject_id:fixture.split_booking_id},headers:{Origin:new URL(page.url()).origin}}));
    await page.goto(split.review_path);
    await page.getByRole('radio',{name:'Yes',exact:true}).check();
    await page.getByLabel('Wallet amount (QAR)').fill('30.00');
    await page.getByRole('button',{name:'Continue to card payment',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Isolated card checkout'})).toBeVisible();
    const held=await json(await page.request.get(`/api/customer/purchase-funding/${split.purchase_id}`));
    expect(held.wallet.balance_minor).toBe(90000);expect(held.wallet.available_minor).toBe(87000);
    await promisify(execFile)('bash',[process.env.WALLET_E2E_QA_RUNNER ?? '../bubbleit-backend/scripts/accounting-local/qa.sh','wallet-e2e-capture',String(split.purchase_id)]);
    await page.goto(split.review_path);await expect(page.getByText('Payment confirmed',{exact:true})).toBeVisible();
    const refund=await json(await staff.post('admin/refunds/complete',{data:{command_key:crypto.randomUUID(),subject_type:'booking',subject_id:fixture.split_booking_id,amount:'100.00',reason:'Isolated QA customer return.',settlement_destination:'original_payment',customer_refunded:true,refund_method:'bank_transfer',reference:'QA customer return receipt'}}));
    expect(refund.status).toBe('processed');expect(refund.settled_amount_minor).toBe(10000);
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    const online=await json(await page.request.post('/api/customer/purchase-funding/prepare',{data:{subject_type:'booking',subject_id:fixture.online_booking_id},headers:{Origin:new URL(page.url()).origin}}));
    await page.goto(online.review_path);
    await page.getByRole('radio',{name:'Yes',exact:true}).check();
    await page.getByLabel('Wallet amount (QAR)').fill('30.00');
    await page.getByRole('button',{name:'Continue to card payment',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Isolated card checkout'})).toBeVisible();
    await promisify(execFile)('bash',[process.env.WALLET_E2E_QA_RUNNER ?? '../bubbleit-backend/scripts/accounting-local/qa.sh','wallet-e2e-capture',String(online.purchase_id)]);
    await page.goto(online.review_path);
    await expect(page.getByText('Payment confirmed',{exact:true})).toBeVisible();
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(87000);
    await json(await staff.post('admin/refunds/complete',{data:{command_key:crypto.randomUUID(),subject_type:'booking',subject_id:fixture.online_booking_id,amount:'100.00',reason:'QA source return after simulator capture.',settlement_destination:'original_payment',customer_refunded:true,refund_method:'bank_transfer',reference:'QA recorded return'}}));
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    const late = await json(await page.request.post('/api/customer/purchase-funding/prepare',{data:{subject_type:'booking',subject_id:fixture.late_booking_id},headers:{Origin:new URL(page.url()).origin}}));
    await page.goto(late.review_path);
    await page.getByRole('radio',{name:'Yes',exact:true}).check();
    await page.getByLabel('Wallet amount (QAR)').fill('30.00');
    await page.getByRole('button',{name:'Continue to card payment',exact:true}).click();
    await page.goto(late.review_path);
    await expect(page.getByRole('button',{name:'Cancel wallet payment',exact:true})).toBeVisible();
    const latePlan = await json(await page.request.get(`/api/customer/purchase-funding/${late.purchase_id}`));
    await page.getByRole('button',{name:'Cancel wallet payment',exact:true}).click();
    await expect(page.getByRole('radio',{name:'No',exact:true})).toBeChecked();
    expect(latePlan.funding.external_amount_minor).toBe(7000);
    await promisify(execFile)('bash',[process.env.WALLET_E2E_QA_RUNNER ?? '../bubbleit-backend/scripts/accounting-local/qa.sh','wallet-e2e-capture',String(late.purchase_id)]);
    await page.reload();
    await expect(page.getByText('Payment under review',{exact:true})).toBeVisible();
    const sourceReview = await json(await staff.get(`admin/purchase-funding/review?subject_type=booking&subject_id=${fixture.late_booking_id}`));
    expect(sourceReview.unapplied_sources).toHaveLength(1);
    const admin = await playwright.request.newContext({baseURL:'http://127.0.0.1:8840/api/v1/',extraHTTPHeaders:{Authorization:`Bearer ${fixture.admin_token}`,Accept:'application/json'}});
    try {
      const lateReturn = {command_key:crypto.randomUUID(),subject_type:'booking',subject_id:fixture.late_booking_id,unapplied_source_id:sourceReview.unapplied_sources[0].id,amount:'70.00',reason:'QA actual late receipt returned.',settlement_destination:'original_payment',customer_refunded:true,refund_method:'bank_transfer'};
      const reviewed = await json(await admin.post('admin/refunds/complete',{data:lateReturn}));expect(reviewed.status).toBe('processed');
      expect((await json(await admin.post('admin/refunds/complete',{data:lateReturn}))).id).toBe(reviewed.id);
    } finally {await admin.dispose();}
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    expect((await json(await staff.get(`admin/purchase-funding/review?subject_type=booking&subject_id=${fixture.late_booking_id}`))).unapplied_sources).toHaveLength(0);
    const card=await json(await page.request.post('/api/customer/purchase-funding/prepare',{data:{subject_type:'booking',subject_id:fixture.card_booking_id},headers:{Origin:new URL(page.url()).origin}}));
    await page.goto(card.review_path);
    await expect(page.getByRole('radio',{name:'No',exact:true})).toBeChecked();
    await page.getByRole('button',{name:'Continue to card payment',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Isolated card checkout'})).toBeVisible();
    const noWallet=await json(await page.request.get(`/api/customer/purchase-funding/${card.purchase_id}`));
    expect(noWallet.funding).toBeNull();expect(noWallet.wallet.available_minor).toBe(90000);
    await promisify(execFile)('bash',[process.env.WALLET_E2E_QA_RUNNER ?? '../bubbleit-backend/scripts/accounting-local/qa.sh','wallet-e2e-capture',String(card.purchase_id)]);
    await page.goto(card.review_path);await expect(page.getByText('Payment confirmed',{exact:true})).toBeVisible();
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    await json(await staff.post('admin/refunds/complete',{data:{command_key:crypto.randomUUID(),subject_type:'booking',subject_id:fixture.card_booking_id,amount:'100.00',reason:'QA full card payment returned.',settlement_destination:'original_payment',customer_refunded:true,refund_method:'bank_transfer'}}));
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    // Customer cancellation must create a request before staff settles any wallet credit.
    const refundableBooking=await json(await page.request.get(`/api/customer/bookings/${fixture.subjects.booking}`));
    await page.goto('/account');await page.getByRole('tab',{name:'Bookings',exact:true}).click();
    const refundableCard=page.getByRole('article').filter({hasText:refundableBooking.reference});
    page.once('dialog',dialog=>dialog.accept());
    await refundableCard.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(refundableCard).toContainText('Refund');
    const customerRefunds=await json(await page.request.get('/api/customer/refunds'));
    const requested=customerRefunds.data.find((refund: {booking_id:number})=>refund.booking_id===fixture.subjects.booking);
    expect(requested.status).toBe('submitted');expect(requested.amount_minor).toBe(10000);
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(90000);
    const completedRequest=await json(await staff.post(`admin/refunds/${requested.id}/complete`,{data:{command_key:crypto.randomUUID(),settlement_destination:'customer_wallet'}}));
    expect(completedRequest.status).toBe('processed');
    expect((await json(await page.request.get('/api/customer/wallet'))).balance_minor).toBe(100000);
    const accounting = await json(await staff.get('admin/accounting/reconciliation'));
    expect(accounting.findings).toEqual([]);
    const journals = await json(await staff.get('admin/accounting/journal-reconciliation'));
    expect(journals.findings).toEqual([]);
    await page.goto('/account');await page.getByRole('tab',{name:'Wallet',exact:true}).click();
    await expect(page.getByText('Wallet and refunds',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Wallet activity',exact:true})).toBeVisible();
    expect((await new AxeBuilder({page}).include('main').analyze()).violations).toEqual([]);
    await page.context().addCookies([{name:'bubbleit.lang',value:'ar',domain:'127.0.0.1',path:'/'}]);
    await page.setViewportSize({width:320,height:760});await page.goto(`/account/payments/${purchases[0]}`);
    await expect(page.getByRole('heading',{name:'إكمال الدفع'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await json(await page.request.post('/api/customer/auth/logout',{headers:{Origin:new URL(page.url()).origin}}));
    await json(await page.request.post('/api/customer/auth/login',{data:fixture.other_owner,headers:{Origin:new URL(page.url()).origin}}));
    expect((await page.request.get(`/api/customer/purchase-funding/${purchases[0]}`)).status()).toBe(404);
  } finally {await staff.dispose();}
});
