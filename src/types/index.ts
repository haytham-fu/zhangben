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

/** 买菜品类 */
export type GroceryKind =
  | 'veg'
  | 'meat'
  | 'egg'
  | 'staple'
  | 'fruit'
  | 'seasoning'
  | 'custom';

export interface Category {
  id: string;
  name: string;
  bucket: Bucket;
  icon: string;
  allowOctopus?: boolean;
  /** Show payment method picker for this category on expenses */
  allowPayment?: boolean;
}

/** Transfer into/out of a 小荷包 (piggy-bank style) */
export type WalletTransferSource = 'total' | 'basic' | 'special' | 'settle';

export interface WalletTransfer {
  id: string;
  direction: 'in' | 'out';
  amount: number;
  /** Where money came from / went to conceptually */
  source?: WalletTransferSource;
  /** Month key for settlement transfers, e.g. 2026-09 */
  ym?: string;
  note?: string;
  createdAt: string;
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
  /** Current RMB in this 小荷包 (filled via 转入 / 结算; spend-from-jar decreases it) */
  balance: number;
  /** Optional savings target (edit only; progress bar when set) */
  target?: number | null;
  /** Optional transfer history */
  transfers?: WalletTransfer[];
  /**
   * System flag: 「小钱猪」 auto overflow/shortfall jar.
   * Not user-deletable; always ensured present.
   */
  systemKey?: 'pig' | null;
  createdAt: string;
}

/** 冰箱/食材库存（买菜后写入，做饭时扣减） */
export interface PantryItem {
  id: string;
  name: string;
  kind: GroceryKind;
  /** 自己实际承担金额（RMB，AA 后） */
  costRmb: number;
  mealsTotal: number;
  mealsLeft: number;
  /** costRmb / mealsTotal */
  costPerMeal: number;
  boughtDate: string;
  notes?: string;
  /** 关联的买菜支出流水 id */
  purchaseTxId?: string | null;
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
  /** 买菜支出：一次性购入多品 */
  isGroceryPurchase?: boolean;
  /** 本笔买菜创建的库存 id */
  groceryLotIds?: string[];
  /** 做饭时用到的库存 id */
  pantryUseIds?: string[];
  /** 从库存估算计入本餐的 RMB */
  pantryCostRmb?: number;
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

export interface MonthOpening {
  /** yyyy-MM this opening applies to */
  ym: string;
  /** Net basic already used before new txs (expense − income in basic) */
  basicUsed: number;
  /** Net special already used before new txs */
  specialUsed: number;
  /** Optional display: first-half gross expense RMB */
  expenseRmb?: number;
  /** Optional display: first-half income RMB */
  incomeRmb?: number;
  /** Short label shown in UI */
  label?: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  lastSyncAt: string;
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
  /** Dashboard top monthly budget progress (used / remain + ProgressBar) */
  showMonthlyBudgetProgress: boolean;
  /** Soft color palette for glass UI */
  themePalette: ThemePalette;
  /** Static vs flowing animated page background */
  bgMotion: BgMotion;
  /**
   * Month keys (yyyy-MM) already settled into 「小钱猪」.
   * Prevents double settlement for the same month.
   */
  settledMonths?: string[];
  /**
   * Prior-period summary for the current month (no daily line items).
   * Budget "used" = opening + txs in this ym.
   */
  monthOpening?: MonthOpening | null;
  /** Stable id for this browser/device (generated once). */
  deviceId?: string;
  /** Editable display name shown in paired device list. */
  deviceName?: string;
  /** Shared pairing code (6–8 chars) when devices are linked. */
  linkCode?: string | null;
  /** HTTPS URL of hosted sync JSON (网盘 / GitHub raw). */
  lastSyncUrl?: string | null;
  /** When true, try pull from lastSyncUrl on app open. */
  autoPullSync?: boolean;
  /** Devices seen in sync packs (id + name + lastSyncAt). */
  knownDevices?: PairedDevice[];
}

export interface AppState {
  settings: Settings;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  /** 冰箱/食材库存 */
  pantryItems: PantryItem[];
}
