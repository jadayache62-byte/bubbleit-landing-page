'use client';

import {useEffect, useId, useRef, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {cancelWalletPurchase, confirmWalletPurchase, getWalletPurchase, initializeMembershipPayment, payWalletPurchaseByCard, prepareWalletPurchase} from '@/lib/api/client';
import {exactWalletMinor, type FundingReview, type PurchaseSubject} from '@/lib/api/funding-types';
import {usableCheckoutUrl} from '@/lib/booking/payment-flow';
import {formatQar} from '@/lib/money';
import {useI18n} from '@/lib/i18n';
import {AppToast} from '@/components/AppToast';

export function CompletePaymentButton({subjectType, subjectId, reviewPath, walletAvailable, disabled, onCardPayment, onUpdated}: {
  subjectType: PurchaseSubject; subjectId: number; reviewPath?: string|null;
  walletAvailable?: boolean; disabled?: boolean; onCardPayment?: () => void; onUpdated?: () => void;
}) {
  const {t} = useI18n();
  const [review,setReview] = useState<FundingReview|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const opening = useRef(false);
  const trigger=useRef<HTMLButtonElement>(null);
  async function open() {
    if (opening.current || disabled) return;
    if (!walletAvailable && !reviewPath && onCardPayment) {onCardPayment(); return;}
    opening.current=true; setBusy(true); setError(false);
    try {
      if (!walletAvailable && !reviewPath && subjectType==='membership') {
        const payment=await initializeMembershipPayment(subjectId,crypto.randomUUID(),'skipcash_hosted');
        const checkout=usableCheckoutUrl(payment.checkout_url);
        if(checkout) window.location.assign(checkout);else setError(true);
        return;
      }
      const match = reviewPath?.match(/^\/account\/payments\/([1-9][0-9]*)$/);
      setReview(match ? await getWalletPurchase(Number(match[1])) : await prepareWalletPurchase(subjectType,subjectId));
    } catch {setError(true);}
    finally {opening.current=false;setBusy(false);}
  }
  return <><button ref={trigger} type="button" disabled={disabled || busy} onClick={()=>void open()} className="primary-button min-h-11 px-4">{t(busy ? 'Checking payment…' : 'Complete payment')}</button>
    {review && <PurchasePaymentModal initialReview={review} returnFocusRef={trigger} onClose={()=>setReview(null)} onUpdated={onUpdated}/>}
    {error && <AppToast message={t('Payment review is unavailable. Refresh and try again.')} dismissLabel={t('Dismiss')} onDismiss={()=>setError(false)}/>}
  </>;
}

export function PurchasePaymentModal({initialReview,onClose,onUpdated,returnFocusRef}: {initialReview: FundingReview; onClose: () => void; onUpdated?: () => void; returnFocusRef?: RefObject<HTMLButtonElement|null>}) {
  const {lang,t}=useI18n();
  const titleId=useId();
  const dialog=useRef<HTMLDialogElement>(null);
  const mutation=useRef(false);
  const command=useRef<string|null>(null);
  const requestVersion=useRef(0);
  const [review,setReview]=useState(initialReview);
  const [useWallet,setUseWallet]=useState(false);
  const [amount,setAmount]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const element=dialog.current;
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget=returnFocusRef?.current ?? previous;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    element?.showModal();
    return ()=>{element?.close();document.body.style.overflow=overflow;returnTarget?.focus({preventScroll:true});};
  },[returnFocusRef]);
  useEffect(()=>{
    const counter=requestVersion;
    async function refresh() {
      if(mutation.current) return;
      const version=++requestVersion.current;
      try {const next=await getWalletPurchase(initialReview.purchase_id);if(version===requestVersion.current) {setReview(next);setError(false);}}
      catch {if(version===requestVersion.current) setError(true);}
    }
    const focus=()=>void refresh();
    window.addEventListener('focus',focus);
    return ()=>{++counter.current;window.removeEventListener('focus',focus);};
  },[initialReview.purchase_id]);
  const held=review.funding?.status==='awaiting_remainder';
  const paid=['paid','partially_refunded','refunded'].includes(review.status);
  const paidNotice=review.status==='paid' ? t('Payment confirmed') : t('Refund recorded');
  const closedNotice=review.status==='pending' ? t('Payment under review') : t('This purchase is closed.');
  const canChoose=review.status==='pending' && review.can_confirm!==false && !held;
  const canUseWallet=review.wallet.capabilities.can_spend && review.wallet.available_minor>0;
  const minor=useWallet ? exactWalletMinor(amount) : 0;
  const remainder=minor===null ? null : review.amount_minor-minor;
  const valid=canChoose && (!useWallet || (canUseWallet && minor!==null && minor<=review.amount_minor && minor<=review.wallet.available_minor && (remainder===0 || review.external_channels.includes('skipcash_hosted'))));
  async function refreshAfterError() {
    try {setReview(await getWalletPurchase(review.purchase_id));} catch {/* Keep the last verified facts and block a blind retry. */}
    setError(true);
  }
  function checkout(url: unknown) {
    const safe=usableCheckoutUrl(url);
    if(safe) window.location.assign(safe);
    else setError(true);
  }
  async function pay() {
    if(!valid || mutation.current || error) return;
    mutation.current=true;setBusy(true);++requestVersion.current;
    command.current ??= crypto.randomUUID();
    try {
      if(useWallet) {
        const next=await confirmWalletPurchase(review.purchase_id,{wallet_amount:amount,external_channel:remainder===0 ? null : 'skipcash_hosted',command_key:command.current});
        setReview(next);onUpdated?.();
        if(next.status==='paid') onClose();
        else if(next.funding?.external_channel==='skipcash_hosted') checkout(next.funding.checkout_url);
      } else {
        const payment=await payWalletPurchaseByCard(review.purchase_id,command.current);
        onUpdated?.();checkout(payment.checkout_url);
      }
    } catch {await refreshAfterError();}
    finally {mutation.current=false;setBusy(false);}
  }
  async function cancelHold() {
    if(!review.funding || mutation.current) return;
    mutation.current=true;setBusy(true);++requestVersion.current;
    try {setReview(await cancelWalletPurchase(review.purchase_id,review.funding.id));command.current=null;setError(false);setUseWallet(false);setAmount('');onUpdated?.();}
    catch {await refreshAfterError();}
    finally {mutation.current=false;setBusy(false);}
  }
  async function retry() {
    if(mutation.current) return;
    mutation.current=true;setBusy(true);++requestVersion.current;
    try {setReview(await getWalletPurchase(review.purchase_id));setError(false);onUpdated?.();}
    catch {setError(true);}
    finally {mutation.current=false;setBusy(false);}
  }
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[color:var(--navy)] shadow-xl backdrop:bg-slate-950/40" onKeyDown={event=>{
    if(event.key!=='Tab') return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]'));
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
  }} onCancel={event=>{event.preventDefault();if(!mutation.current) onClose();}}>
    <div className="flex items-start justify-between gap-4"><h2 id={titleId} className="text-xl font-bold">{t('Complete payment')}</h2><button type="button" disabled={busy} aria-label={t('Close')} className="min-h-11 min-w-11 rounded-full border border-slate-200" onClick={onClose}>×</button></div>
    {review.subject_reference && <p className="mt-2 break-words text-sm">{review.subject_reference}</p>}
    <p className="mt-4 flex flex-wrap justify-between gap-2 font-semibold"><span>{t('Purchase total')}</span><span>{formatQar(review.amount_minor/100,lang)}</span></p>
    {paid ? <p role="status" className="mt-4">{paidNotice}</p> : held && review.funding ? <div className="mt-4 space-y-4">
      <p>{t('Wallet credit is held until the remaining payment is confirmed.')}</p>
      <p>{t('Wallet credit')}: {formatQar(review.funding.wallet_amount_minor/100,lang)}</p><p>{t('Remaining payment')}: {formatQar(review.funding.external_amount_minor/100,lang)}</p>
      {review.funding.external_channel==='skipcash_hosted' && review.funding.remainder_collection_available!==false && usableCheckoutUrl(review.funding.checkout_url)
        ? <a className="primary-button min-h-11 w-full px-4" href={usableCheckoutUrl(review.funding.checkout_url)!} onClick={event=>{if(!review.funding || Date.parse(review.funding.expires_at)<=Date.now()) {event.preventDefault();void retry();}}}>{t('Continue to card payment')}</a>
        : <p role="status">{t('Payment is awaiting verification. Cancel the wallet hold before changing payment.')}</p>}
      <button type="button" className="secondary-button min-h-11 w-full px-4" disabled={busy} onClick={()=>void cancelHold()}>{t('Cancel wallet payment')}</button>
    </div> : canChoose ? <form className="mt-5 space-y-4" onSubmit={event=>{event.preventDefault();void pay();}}>
      {canUseWallet ? <><p className="text-sm">{t('Available wallet credit')}: {formatQar(review.wallet.available_minor/100,lang)}</p>
        <fieldset disabled={busy}><legend className="font-semibold">{t('Would you like to use wallet credit?')}</legend><div className="mt-2 flex gap-3">{[false,true].map(choice=><label key={String(choice)} className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3"><input type="radio" name={`wallet-${titleId}`} checked={useWallet===choice} onChange={()=>{setUseWallet(choice);command.current=null;}}/>{t(choice ? 'Yes' : 'No')}</label>)}</div></fieldset>
        {useWallet && <label className="block font-semibold">{t('Wallet amount (QAR)')}<input autoFocus inputMode="decimal" required disabled={busy} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 p-3" value={amount} onChange={event=>{setAmount(event.target.value);command.current=null;}}/><span className="mt-2 block text-sm font-normal">{t('Enter an amount up to the available credit and purchase total.')}</span></label>}
      </> : <p>{t('Continue securely with your card.')}</p>}
      {useWallet && remainder!==null && remainder>=0 && <p>{t('Remaining card payment')}: {formatQar(remainder/100,lang)}</p>}
      <button type="submit" className="primary-button min-h-11 w-full px-4" disabled={busy || !valid || error}>{t(busy ? 'Checking payment…' : useWallet && remainder===0 ? 'Complete payment' : 'Continue to card payment')}</button>
    </form> : <p role="status" className="mt-4">{closedNotice}</p>}
    {error && <div role="alert" className="mt-4 space-y-3"><p>{t('Payment review is unavailable. Refresh and try again.')}</p><button type="button" disabled={busy} className="secondary-button min-h-11 px-4" onClick={()=>void retry()}>{t('Retry')}</button></div>}
  </dialog>,document.body);
}
