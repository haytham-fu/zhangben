export type Currency = 'RMB' | 'HKD' | 'USD';

export type Bucket = 'basic' | 'special';

export type TxType = 'expense' | 'income';

export type PaymentMethod =
  | 'octopus'
  | 'wechat'
  | 'alipay'
  | 'bank'
  | 'credit'
  | 'other'
  | 'none';

export type SatMode = 'play' | 'stay';

/** Top-up / balance-only: does not count toward budget spending */
export type TxKind = 'normal' | 'topup';

export interface Category {
  id: string;
  name: string;
  bucket: Bucket;
  icon: string;
  allowOctopus?: boolean;
  /** Show payment method picker for this category on expenses */
  allowPayment?: boolean;
}

export interface Transaction {
  id: string;
  type: TxType;
  kind: TxKind;
  date: string; // YYYY-MM-DD
  amount: number; // original currency amount
  currency: Currency;
  rate: number; // to RMB
  amountRmb: number;
  categoryId: string;
  bucket: Bucket;
  note: string;
  isSpecial: boolean; // 请客 etc.
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface DailyPlan {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  satPlay: number;
  satStay: number;
  sun: number;
}

export interface Settings {
  basicBudget: number;
  specialBudget: number;
  hkdRate: number; // 1 HKD = x RMB
  usdRate: number;
  dailyPlan: DailyPlan;
  defaultSatMode: SatMode;
  /** Per-date sat mode overrides: YYYY-MM-DD -> play|stay */
  satModeOverrides: Record<string, SatMode>;
  musicMembershipHkd: number;
  musicMembershipEnabled: boolean;
  includeSpecialInAdvice: boolean;
  themeColor: string;
}

export interface AppState {
  settings: Settings;
  transactions: Transaction[];
  categories: Category[];
}
