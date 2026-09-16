export type Currency =
  | 'RMB'
  | 'HKD'
  | 'USD'
  | 'EUR'
  | 'JPY'
  | 'GBP'
  | 'TWD'
  | 'MOP'
  | 'SGD';

export type ForeignCurrency = Exclude<Currency, 'RMB'>;

export type Bucket = 'basic' | 'special';

/** Wallet peer-level kind: independent of 基础/专项 nesting; legacy basic/special kept for migration */
export type WalletBucket = Bucket | 'custom';

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

/** App background / accent palette (soft, glass-friendly) */
export type ThemePalette = 'sky' | 'mist' | 'sand' | 'sage' | 'lilac';

/** Body background motion */
export type BgMotion = 'static' | 'dynamic';

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
  /**
   * Optional budget-area hint. New wallets use 'custom' (peer of 基础/专项).
   * Legacy 'basic' | 'special' values are kept for graceful migration.
   */
  bucket: WalletBucket | null;
  /** RMB allocated to this wallet */
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
  /** Monthly recurring expense (membership-like); usually 专项 */
  isMonthly: boolean;
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
  /** Fixed RMB per 1 foreign unit (RMB = 1 always) */
  fixedRates: Record<ForeignCurrency, number>;
  dailyPlan: DailyPlan;
  defaultSatMode: SatMode;
  /** Per-date sat mode overrides: YYYY-MM-DD -> play|stay */
  satModeOverrides: Record<string, SatMode>;
  includeSpecialInAdvice: boolean;
  /** When true: daily plan vs actual, calendar remaining, plan-based advice */
  dailyPlanCompareEnabled: boolean;
  /** live = fetch market rate; fixed = use fixedRates */
  fxRateMode: FxRateMode;
  /** Last successful live rates (RMB per 1 foreign) */
  liveRates: Partial<Record<ForeignCurrency, number>>;
  liveRatesUpdatedAt: string | null;
  /**
   * Up to 4 preferred currencies for conversion / picker favoritism.
   * RMB may be included; always treated as base rate 1.
   */
  preferredCurrencies: Currency[];
  themeColor: string;
  /** Dashboard 小金山 illustration for remaining budget */
  showGoldMountain: boolean;
  /** Soft color palette for glass UI */
  themePalette: ThemePalette;
  /** Static vs flowing animated page background */
  bgMotion: BgMotion;
}

export interface AppState {
  settings: Settings;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
}
