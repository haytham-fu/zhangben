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

export type FxRateMode = 'live' | 'fixed';

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

export interface Wallet {
  id: string;
  name: string;
  color: string;
  bucket: Bucket;
  /** RMB allocated from the bucket budget */
  allocated: number;
  createdAt: string;
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
  /** Optional 小荷包 link */
  walletId?: string | null;
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
  /** When true: daily plan vs actual, calendar remaining, plan-based advice */
  dailyPlanCompareEnabled: boolean;
  /** live = fetch market rate; fixed = use hkdRate/usdRate */
  fxRateMode: FxRateMode;
  /** Last successful live rates (RMB per 1 foreign); used as cache / display */
  liveHkdRate: number | null;
  liveUsdRate: number | null;
  liveRatesUpdatedAt: string | null;
  themeColor: string;
}

export interface AppState {
  settings: Settings;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
}
