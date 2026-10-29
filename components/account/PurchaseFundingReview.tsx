'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ApiError,getWalletPurchase,me} from '@/lib/api/client';
import type {FundingReview} from '@/lib/api/funding-types';
import {Navbar} from '@/components/Navbar';
import {Footer} from '@/components/Footer';
import {AuthPanel} from '@/components/booking/AuthPanel';
import {PurchasePaymentModal} from '@/components/account/CompletePaymentButton';
import {formatQar} from '@/lib/money';
import {useI18n} from '@/lib/i18n';

export function PurchaseFundingReview({purchaseId}: {purchaseId: number}) {
  const {lang,t}=useI18n();
  const [review,setReview]=useState<FundingReview|null>(null);
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [error,setError]=useState(false);
  const [open,setOpen]=useState(false);
  const opened=useRef(false);
  const version=useRef(0);
  const load=useCallback(async()=>{
    const current=++version.current;
    try {
      await me();
      const next=await getWalletPurchase(purchaseId);
      if(current!==version.current) return;
      setSignedIn(true);setReview(next);setError(false);
      if(!opened.current && next.status==='pending') {opened.current=true;setOpen(true);}
    } catch(caught) {
      if(current!==version.current) return;
      if(caught instanceof ApiError && caught.status===401) {setSignedIn(false);setReview(null);}
      else setError(true);
    }
  },[purchaseId]);
  useEffect(()=>{const counter=version;void Promise.resolve().then(load);return ()=>{++counter.current;};},[load]);
  const paid=review && ['paid','partially_refunded','refunded'].includes(review.status);
  const paidNotice=review?.status==='paid' ? t('Payment confirmed') : t('Refund recorded');
  return <><Navbar/><main className="mx-auto min-h-[70vh] max-w-xl px-4 py-28"><h1 className="text-3xl font-bold">{t('Complete payment')}</h1>
    {signedIn===false ? <AuthPanel onAuthed={()=>void load()}/> : review ? <section className="commerce-card mt-6 space-y-5 p-5">
      {review.subject_reference && <h2 className="text-xl font-bold">{review.subject_reference}</h2>}
      <p className="flex flex-wrap justify-between gap-2"><span>{t('Purchase total')}</span><span>{formatQar(review.amount_minor/100,lang)}</span></p>
      {paid ? <p role="status">{paidNotice}</p> : review.status==='pending' ? <button type="button" className="primary-button min-h-11 px-4" onClick={()=>setOpen(true)}>{t('Complete payment')}</button> : <p>{t('This purchase is closed.')}</p>}
      {open && <PurchasePaymentModal initialReview={review} onClose={()=>{setOpen(false);void load();}}/>}
    </section> : !error && <p role="status" className="mt-6">{t('Checking payment…')}</p>}
    {error && <div role="alert" className="mt-6"><p>{t('Payment review is unavailable. Refresh and try again.')}</p><button type="button" className="secondary-button mt-4 min-h-11 px-4" onClick={()=>void load()}>{t('Retry')}</button></div>}
    <Link href="/account" className="mt-6 inline-flex min-h-11 items-center">{t('Back to account')}</Link>
  </main><Footer/></>;
}
