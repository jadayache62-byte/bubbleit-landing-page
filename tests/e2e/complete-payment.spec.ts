import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fixture(page: Page, options: {paidMembership?: boolean; unavailable?: boolean; held?: boolean}={}) {
  const commands: {path:string;body:Record<string,unknown>}[]=[];
  const wallet={currency:'QAR',balance_minor:15000,reserved_minor:0,available_minor:15000,as_of:'2026-10-28T10:00:00Z',capabilities:{can_spend:true}};
  let review={purchase_id:1,subject_type:'booking',subject_id:5,subject_reference:'BK-QA-5',amount_minor:10000,currency:'QAR',status:'pending',review_path:'/account/payments/1',wallet,external_channels:['skipcash_hosted'],can_confirm:true,funding:options.held ? {id:2,status:'awaiting_remainder',wallet_amount_minor:3000,external_amount_minor:7000,external_channel:'bank_transfer',expires_at:'2099-10-28T11:00:00Z',checkout_url:null,remainder_collection_available:true} : null as unknown};
  await page.route('https://payments.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Isolated card checkout</h1>'}));
  await page.route('**/api/customer/**',async route=>{
    const path=new URL(route.request().url()).pathname.replace('/api/customer','');
    const reply=(data:unknown,status=200)=>route.fulfill({status,json:{success:status===200,message:'',data,errors:null}});
    const paged=(data:unknown[])=>({data,meta:{current_page:1,last_page:1,total:data.length,per_page:20}});
    if(path==='/auth/me') return reply({id:1,name:'QA customer',phone:'+97470000001',email:null});
    if(path==='/purchase-funding/prepare') return reply(review);
    if(path==='/purchase-funding/1') return reply(options.unavailable ? null : review,options.unavailable ? 503 : 200);
    if(path==='/purchase-funding/1/card') {commands.push({path,body:route.request().postDataJSON()});return reply({checkout_url:'https://payments.invalid/card'});}
    if(path==='/purchase-funding/1/confirm') {
      const body=route.request().postDataJSON();commands.push({path,body});
      const minor=Number(body.wallet_amount)*100;
      review={...review,status:minor===10000 ? 'paid' : 'pending',funding:{id:2,status:minor===10000 ? 'completed' : 'awaiting_remainder',wallet_amount_minor:minor,external_amount_minor:10000-minor,external_channel:minor===10000 ? null : 'skipcash_hosted',expires_at:'2099-10-28T11:00:00Z',checkout_url:minor===10000 ? null : 'https://payments.invalid/remainder'}};
      return reply(review);
    }
    if(path==='/purchase-funding/1/cancel') {commands.push({path,body:route.request().postDataJSON()});review={...review,funding:null};return reply(review);}
    if(path==='/bookings') return reply(paged([{id:5,reference:'BK-QA-5',status:'pending_payment',status_label:'Pending payment',scheduled_at:'2026-11-06T12:00:00Z',total:100,cars:[],notes:'',address_area:'QA Doha',created_at:'2026-10-28T10:00:00Z',payment:{status:'pending',captured:false},wallet_payment_available:true,wallet_review_path:'/account/payments/1'}]));
    if(path==='/memberships' && options.paidMembership) return reply(paged([{id:1,status:'active',washes_remaining:4,washes_used:0,price_paid:100,plan:{id:1,name:'Paid QA Plan',price:100,washes_count:4,vehicle_type:'sedan'},payment:{status:'paid',captured:true},wallet_payment_available:true,wallet_review_path:'/account/payments/2'}]));
    if(path==='/loyalty') return reply(null,503);
    return reply(paged([]));
  });
  return commands;
}

test('unpaid account card has one payment action and No continues by card without confirming a wallet amount',async({page})=>{
  const commands=await fixture(page);await page.goto('/account');
  await expect(page.getByRole('button',{name:'Complete payment',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Use wallet credit',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Complete payment',exact:true}).click();
  const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
  await expect(modal.getByRole('radio',{name:'No',exact:true})).toBeChecked();
  await expect(modal.getByLabel('Wallet amount (QAR)')).toHaveCount(0);
  await expect(modal.getByRole('combobox')).toHaveCount(0);
  await modal.getByRole('button',{name:'Continue to card payment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Isolated card checkout'})).toBeVisible();
  expect(commands.map(command=>command.path)).toEqual(['/purchase-funding/1/card']);
  expect(commands[0].body).not.toHaveProperty('wallet_amount');
});

for(const amount of ['30.00','100.00']) test(`Yes authorizes only the chosen ${amount} wallet amount`,async({page})=>{
  const commands=await fixture(page);await page.goto('/account/payments/1');
  const modal=page.getByRole('dialog');await modal.getByRole('radio',{name:'Yes',exact:true}).check();
  const input=modal.getByLabel('Wallet amount (QAR)');await input.fill('100.001');
  await expect(modal.getByRole('button',{name:'Continue to card payment',exact:true})).toBeDisabled();
  await input.fill(amount);
  await modal.getByRole('button',{name:amount==='100.00' ? 'Complete payment' : 'Continue to card payment',exact:true}).click();
  await expect(page.getByText(amount==='100.00' ? 'Payment confirmed' : 'Isolated card checkout',{exact:true})).toBeVisible();
  expect(commands).toHaveLength(1);expect(commands[0].body).toMatchObject({wallet_amount:amount,external_channel:amount==='100.00' ? null : 'skipcash_hosted'});
});

test('paid membership never offers a payment action even if an old review path remains',async({page})=>{
  await fixture(page,{paidMembership:true});await page.goto('/account');await page.getByRole('tab',{name:'Memberships',exact:true}).click();
  const card=page.getByRole('article').filter({hasText:'Paid QA Plan'});await expect(card.getByRole('link',{name:'Book a Wash',exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:/payment|wallet/i})).toHaveCount(0);
});

test('modal traps focus, closes with Escape, restores focus and fits Arabic at 320 pixels',async({page,context})=>{
  await context.addCookies([{name:'bubbleit.lang',value:'ar',domain:'127.0.0.1',path:'/'}]);await page.setViewportSize({width:320,height:760});await fixture(page);await page.goto('/account');
  const trigger=page.getByRole('button',{name:'إكمال الدفع',exact:true});await trigger.click();
  const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
  expect((await new AxeBuilder({page}).include('dialog').analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await modal.getByRole('radio',{name:'نعم',exact:true}).check();
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('historical staff remainder must be cancelled before a new card choice',async({page})=>{
  const commands=await fixture(page,{held:true});await page.goto('/account/payments/1');const modal=page.getByRole('dialog');
  await expect(modal.getByRole('radio')).toHaveCount(0);await expect(modal.getByRole('combobox')).toHaveCount(0);
  await modal.getByRole('button',{name:'Cancel wallet payment',exact:true}).click();
  await expect(modal.getByRole('radio',{name:'No',exact:true})).toBeChecked();
  expect(commands.map(command=>command.path)).toEqual(['/purchase-funding/1/cancel']);
});
