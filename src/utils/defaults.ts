import type { Category, Settings, Wallet } from '../types';
import { DEFAULT_FIXED_RATES, DEFAULT_PREFERRED_CURRENCIES } from './currency';

export const DEFAULT_SETTINGS: Settings = {
  basicBudget: 3500,
  specialBudget: 1500,
  fixedRates: { ...DEFAULT_FIXED_RATES },
  dailyPlan: {
    mon: 131,
    tue: 96,
    wed: 131,
    thu: 76,
    fri: 76,
    satPlay: 280,
    satStay: 11.4,
    sun: 56.4,
  },
  defaultSatMode: 'play',
  satModeOverrides: {},
  includeSpecialInAdvice: true,
  dailyPlanCompareEnabled: true,
  fxRateMode: 'fixed',
  liveRates: {},
  liveRatesUpdatedAt: null,
  preferredCurrencies: [...DEFAULT_PREFERRED_CURRENCIES],
  themeColor: '#3b82f6',
  showMonthlyBudgetProgress: true,
  themePalette: 'sky',
  bgMotion: 'dynamic',
  settledMonths: [],
  /** 2026-09 上半月汇总（无逐日流水）；公网从今天起记账 */
  monthOpening: {
    ym: '2026-09',
    basicUsed: 1644.08,
    specialUsed: 531,
    expenseRmb: 2422.86,
    incomeRmb: 247.78,
    label: '9/1–9/15 汇总',
  },
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: '吃饭', bucket: 'basic', icon: '🍜', allowOctopus: true, allowPayment: true },
  { id: 'coffee', name: '咖啡/奶茶', bucket: 'basic', icon: '☕', allowOctopus: true, allowPayment: true },
  { id: 'transport', name: '交通', bucket: 'basic', icon: '🚇', allowOctopus: true, allowPayment: true },
  { id: 'laundry', name: '洗衣', bucket: 'basic', icon: '👕', allowOctopus: true, allowPayment: true },
  { id: 'ac', name: '空调', bucket: 'basic', icon: '❄️', allowOctopus: true, allowPayment: true },
  { id: 'groceries', name: '买菜支出', bucket: 'basic', icon: '🥬', allowPayment: true },
  { id: 'membership', name: '月度支出', bucket: 'special', icon: '📅', allowPayment: true },
  { id: 'sundries', name: '日用品', bucket: 'special', icon: '🧴', allowPayment: true },
  { id: 'furniture', name: '家具电器', bucket: 'special', icon: '🛋️', allowPayment: true },
  { id: 'hobbies', name: '爱好/模型', bucket: 'special', icon: '🎮', allowPayment: true },
  { id: 'income_aa', name: '室友AA', bucket: 'basic', icon: '🤝' },
  { id: 'income_cashback', name: '返现', bucket: 'basic', icon: '💸' },
  { id: 'income_other', name: '其他收入', bucket: 'basic', icon: '➕' },
  { id: 'octopus_topup', name: '八达通充值', bucket: 'basic', icon: '💳', allowOctopus: true, allowPayment: true },
  { id: 'other_basic', name: '其他基础', bucket: 'basic', icon: '📦', allowOctopus: true, allowPayment: true },
  { id: 'other_special', name: '其他专项', bucket: 'special', icon: '📦', allowPayment: true },
];

export const STORAGE_KEY = 'zhangben-v1';

/** Start empty — user creates peer-level 小荷包 (siblings of 基础/专项) */
export const DEFAULT_WALLETS: Wallet[] = [];
