import type {WalletSummary} from './wallet-types';
export type PurchaseSubject = 'booking' | 'membership' | 'store_order' | 'parking_stay';
export type FundingChannel = 'skipcash_hosted' | 'skipcash_qpay' | 'paylater' | 'cash' | 'bank_transfer';
export type FundingReview = {
  subject_reference?: string | null;
  can_confirm?: boolean;
  purchase_id: number; subject_type: PurchaseSubject; subject_id: number;
  amount_minor: number; currency: 'QAR'; status: string; review_path: string;
  wallet: WalletSummary; external_channels: FundingChannel[];
  funding: null | { id: number; status: 'awaiting_remainder' | 'completed' | 'failed' | 'cancelled' | 'expired';
    remainder_collection_available?:boolean;
    wallet_amount_minor: number; external_amount_minor: number; external_channel: FundingChannel | null;
    expires_at: string; checkout_url: string | null };
};
const channels = ['skipcash_hosted','skipcash_qpay','paylater','cash','bank_transfer'];
export function validateFundingReview(value: FundingReview): FundingReview {
  if (!value || (value.can_confirm !== undefined && typeof value.can_confirm !== 'boolean') || (value.subject_reference !== undefined && value.subject_reference !== null && typeof value.subject_reference !== 'string') || !Number.isSafeInteger(value.purchase_id) || value.purchase_id < 1
      || !Number.isSafeInteger(value.subject_id) || value.subject_id < 1
      || !['booking','membership','store_order','parking_stay'].includes(value.subject_type)
      || value.currency !== 'QAR' || !Number.isSafeInteger(value.amount_minor) || value.amount_minor < 1
      || !['pending','paid','failed','partially_refunded','refunded','cancelled','quarantined'].includes(value.status)
      || value.review_path !== `/account/payments/${value.purchase_id}`
      || !Array.isArray(value.external_channels) || value.external_channels.some(c => c !== 'skipcash_hosted')) throw new Error('Invalid purchase review');
  const wallet = value.wallet;
  if (!wallet || wallet.currency !== 'QAR' || typeof wallet.capabilities?.can_spend !== 'boolean'
      || ![wallet.balance_minor,wallet.reserved_minor,wallet.available_minor].every(n=>Number.isSafeInteger(n) && n >= 0)
      || wallet.balance_minor !== wallet.reserved_minor+wallet.available_minor || !Number.isFinite(Date.parse(wallet.as_of))) throw new Error('Invalid purchase wallet');
  const plan = value.funding;
  if (plan && (!Number.isSafeInteger(plan.id) || plan.id < 1
      || (plan.remainder_collection_available !== undefined && typeof plan.remainder_collection_available !== 'boolean')
      || !['awaiting_remainder','completed','failed','cancelled','expired'].includes(plan.status)
      || !Number.isSafeInteger(plan.wallet_amount_minor) || plan.wallet_amount_minor < 1
      || !Number.isSafeInteger(plan.external_amount_minor) || plan.external_amount_minor < 0
      || plan.wallet_amount_minor + plan.external_amount_minor !== value.amount_minor
      || (plan.external_amount_minor === 0 ? plan.external_channel !== null : !channels.includes(plan.external_channel ?? ''))
      || !Number.isFinite(Date.parse(plan.expires_at))
      || (plan.checkout_url !== null && typeof plan.checkout_url !== 'string'))) throw new Error('Invalid funding plan');
  return value;
}
export function exactWalletMinor(value: string): number | null {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}
