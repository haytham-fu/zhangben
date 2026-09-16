import type { PaymentMethod } from '../types';

export const PAYMENT_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'octopus', label: '八达通' },
  { id: 'wechat', label: '微信支付' },
  { id: 'alipay', label: '支付宝' },
  { id: 'bank', label: '银行卡' },
  { id: 'credit', label: '信用卡' },
  { id: 'other', label: '其他' },
];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  octopus: '八达通',
  wechat: '微信支付',
  alipay: '支付宝',
  bank: '银行卡',
  credit: '信用卡',
  other: '其他',
  none: '',
};

export function paymentBadgeClass(m: PaymentMethod): string {
  if (m === 'octopus') return 'badge-octopus';
  if (m === 'wechat') return 'badge-wechat';
  if (m === 'alipay') return 'badge-alipay';
  return 'badge-pay';
}
