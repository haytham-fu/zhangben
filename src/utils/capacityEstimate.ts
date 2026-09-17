/** Capacity → conservative longevity estimates for 调料 / 日用品 */

export type CapUnit = 'ml' | 'L' | 'g' | 'kg' | '勺' | '瓶' | '支' | '袋';

export type EstimateKind = 'meals' | 'uses' | 'days';

export type ProductFamily = 'seasoning' | 'sundry' | 'food';

export interface ProductProfile {
  id: string;
  name: string;
  family: ProductFamily;
  /** Internal base for rates */
  base: 'ml' | 'g';
  /**
   * Conservative usage per event in base units.
   * Higher = fewer meals/uses/days (insurance-style underestimate).
   */
  usePerEvent: number;
  estimateKind: EstimateKind;
  /** Suggested size for 瓶 / 支 / 袋 in base units */
  packSize: number;
  units: CapUnit[];
  aliases?: string[];
}

/** 勺 ≈ 15 ml or 15 g */
const SPOON = 15;

/**
 * Built-in profiles. Rates are intentionally a bit high so longevity is underestimated.
 */
export const PRODUCT_PROFILES: ProductProfile[] = [
  // —— 调料（按顿）——
  {
    id: 'oil',
    name: '食用油',
    family: 'seasoning',
    base: 'ml',
    usePerEvent: 12,
    estimateKind: 'meals',
    packSize: 500,
    units: ['ml', 'L', '勺', '瓶'],
    aliases: ['油', '花生油', '菜籽油', '橄榄油'],
  },
  {
    id: 'light_soy',
    name: '生抽',
    family: 'seasoning',
    base: 'ml',
    usePerEvent: 8,
    estimateKind: 'meals',
    packSize: 500,
    units: ['ml', 'L', '勺', '瓶'],
  },
  {
    id: 'dark_soy',
    name: '老抽',
    family: 'seasoning',
    base: 'ml',
    usePerEvent: 5,
    estimateKind: 'meals',
    packSize: 500,
    units: ['ml', 'L', '勺', '瓶'],
  },
  {
    id: 'soy',
    name: '酱油',
    family: 'seasoning',
    base: 'ml',
    usePerEvent: 8,
    estimateKind: 'meals',
    packSize: 500,
    units: ['ml', 'L', '勺', '瓶'],
  },
  {
    id: 'salt',
    name: '盐',
    family: 'seasoning',
    base: 'g',
    usePerEvent: 3,
    estimateKind: 'meals',
    packSize: 400,
    units: ['g', 'kg', '勺', '瓶'],
  },
  {
    id: 'sugar',
    name: '糖',
    family: 'seasoning',
    base: 'g',
    usePerEvent: 5,
    estimateKind: 'meals',
    packSize: 400,
    units: ['g', 'kg', '勺', '瓶'],
    aliases: ['白糖', '冰糖'],
  },
  {
    id: 'vinegar',
    name: '香醋',
    family: 'seasoning',
    base: 'ml',
    usePerEvent: 8,
    estimateKind: 'meals',
    packSize: 500,
    units: ['ml', 'L', '勺', '瓶'],
    aliases: ['醋', '陈醋', '米醋'],
  },
  {
    id: 'oyster',
    name: '蚝油',
    family: 'seasoning',
    base: 'ml',
    usePerEvent: 10,
    estimateKind: 'meals',
    packSize: 260,
    units: ['ml', 'L', 'g', '勺', '瓶'],
  },

  // —— 日用品 ——
  {
    id: 'toothpaste',
    name: '牙膏',
    family: 'sundry',
    base: 'g',
    usePerEvent: 1.5,
    estimateKind: 'uses',
    packSize: 120,
    units: ['g', '支', '瓶'],
  },
  {
    id: 'body_wash',
    name: '沐浴露',
    family: 'sundry',
    base: 'ml',
    usePerEvent: 12,
    estimateKind: 'days',
    packSize: 400,
    units: ['ml', 'L', '瓶'],
    aliases: ['沐浴乳'],
  },
  {
    id: 'shampoo',
    name: '洗发水',
    family: 'sundry',
    base: 'ml',
    usePerEvent: 10,
    estimateKind: 'days',
    packSize: 400,
    units: ['ml', 'L', '瓶'],
    aliases: ['洗发露', '洗发液'],
  },
  {
    id: 'laundry',
    name: '洗衣液',
    family: 'sundry',
    base: 'ml',
    usePerEvent: 35,
    estimateKind: 'uses',
    packSize: 1000,
    units: ['ml', 'L', '瓶', '袋'],
    aliases: ['洗衣凝珠'],
  },
  {
    id: 'dish_soap',
    name: '洗洁精',
    family: 'sundry',
    base: 'ml',
    usePerEvent: 4,
    estimateKind: 'uses',
    packSize: 500,
    units: ['ml', 'L', '瓶'],
  },
  {
    id: 'hand_soap',
    name: '洗手液',
    family: 'sundry',
    base: 'ml',
    usePerEvent: 2,
    estimateKind: 'uses',
    packSize: 250,
    units: ['ml', 'L', '瓶'],
  },
  {
    id: 'conditioner',
    name: '护发素',
    family: 'sundry',
    base: 'ml',
    usePerEvent: 8,
    estimateKind: 'days',
    packSize: 400,
    units: ['ml', 'L', '瓶'],
  },
  {
    id: 'tissue',
    name: '抽纸',
    family: 'sundry',
    base: 'g',
    usePerEvent: 8,
    estimateKind: 'days',
    packSize: 200,
    units: ['g', '袋'],
    aliases: ['纸巾'],
  },
];

/**
 * Lightweight pantry-backfill heuristics for 主食/菜/肉等（非调料）。
 * usePerEvent = 大约每顿消耗的克/毫升；偏保守（配合 CONSERVATIVE 再打九折）。
 * 规则摘要：蔬菜≈150g/顿、肉≈100g/顿、主食≈80g/顿、蛋≈50g/顿、水果≈150g/顿、其他≈120g/顿。
 */
export const FOOD_KIND_PROFILES: Record<string, ProductProfile> = {
  veg: {
    id: 'food_veg',
    name: '蔬菜',
    family: 'food',
    base: 'g',
    usePerEvent: 150,
    estimateKind: 'meals',
    packSize: 500,
    units: ['g', 'kg', 'ml', 'L'],
  },
  meat: {
    id: 'food_meat',
    name: '肉类',
    family: 'food',
    base: 'g',
    usePerEvent: 100,
    estimateKind: 'meals',
    packSize: 500,
    units: ['g', 'kg', 'ml', 'L'],
  },
  egg: {
    id: 'food_egg',
    name: '蛋',
    family: 'food',
    base: 'g',
    usePerEvent: 50,
    estimateKind: 'meals',
    packSize: 500,
    units: ['g', 'kg'],
  },
  staple: {
    id: 'food_staple',
    name: '主食',
    family: 'food',
    base: 'g',
    usePerEvent: 80,
    estimateKind: 'meals',
    packSize: 500,
    units: ['g', 'kg', 'ml', 'L'],
  },
  fruit: {
    id: 'food_fruit',
    name: '水果',
    family: 'food',
    base: 'g',
    usePerEvent: 150,
    estimateKind: 'meals',
    packSize: 500,
    units: ['g', 'kg', 'ml', 'L'],
  },
  custom: {
    id: 'food_custom',
    name: '其他食材',
    family: 'food',
    base: 'g',
    usePerEvent: 120,
    estimateKind: 'meals',
    packSize: 500,
    units: ['g', 'kg', 'ml', 'L'],
  },
};

/** Profile for non-seasoning grocery kinds when estimating meals from g/ml. */
export function foodKindProfile(kind: string): ProductProfile {
  return FOOD_KIND_PROFILES[kind] ?? FOOD_KIND_PROFILES.custom;
}

export function seasoningProfiles(): ProductProfile[] {
  return PRODUCT_PROFILES.filter((p) => p.family === 'seasoning');
}

export function sundryProfiles(): ProductProfile[] {
  return PRODUCT_PROFILES.filter((p) => p.family === 'sundry');
}

export function findProductProfile(name: string): ProductProfile | null {
  const n = name.trim();
  if (!n) return null;
  const exact = PRODUCT_PROFILES.find((p) => p.name === n);
  if (exact) return exact;
  const hit = PRODUCT_PROFILES.find(
    (p) =>
      n.includes(p.name) ||
      p.name.includes(n) ||
      (p.aliases ?? []).some((a) => n.includes(a) || a.includes(n)),
  );
  return hit ?? null;
}

/** Convert user capacity to profile base units. */
export function toBaseAmount(
  amount: number,
  unit: CapUnit,
  profile: ProductProfile,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (unit) {
    case 'ml':
    case 'g':
      return amount;
    case 'L':
    case 'kg':
      return amount * 1000;
    case '勺':
      return amount * SPOON;
    case '瓶':
    case '支':
    case '袋':
      return amount * profile.packSize;
    default:
      return amount;
  }
}

export interface CapacityEstimate {
  count: number;
  kind: EstimateKind;
  /** Chinese label e.g. 「大约可吃 40 顿（粗略保守估算）」 */
  label: string;
  shortLabel: string;
}

/** Extra 0.85 factor = insurance-style underestimate */
const CONSERVATIVE = 0.85;

export function estimateFromCapacity(
  profile: ProductProfile,
  amount: number,
  unit: CapUnit,
): CapacityEstimate | null {
  const baseAmt = toBaseAmount(amount, unit, profile);
  if (baseAmt <= 0 || profile.usePerEvent <= 0) return null;
  const raw = (baseAmt / profile.usePerEvent) * CONSERVATIVE;
  const count = Math.max(1, Math.floor(raw));
  const kind = profile.estimateKind;
  if (kind === 'meals') {
    return {
      count,
      kind,
      label: `大约可吃 ${count} 顿（粗略保守估算）`,
      shortLabel: `约 ${count} 顿`,
    };
  }
  if (kind === 'days') {
    return {
      count,
      kind,
      label: `约可用 ${count} 天（粗略保守估算）`,
      shortLabel: `约 ${count} 天`,
    };
  }
  let label = `约可用 ${count} 次（粗略保守估算）`;
  if (profile.id === 'toothpaste') {
    const days = Math.max(1, Math.floor(count / 2));
    label = `约可用 ${count} 次 · 约 ${days} 天（粗略保守估算）`;
  }
  return {
    count,
    kind,
    label,
    shortLabel: `约 ${count} 次`,
  };
}

export function unitLabel(u: CapUnit): string {
  if (u === '瓶') return '瓶(按建议)';
  if (u === '支') return '支(按建议)';
  if (u === '袋') return '袋(按建议)';
  return u;
}

/** Default unit when opening a profile panel */
export function defaultUnit(profile: ProductProfile): CapUnit {
  if (profile.units.includes('瓶')) return '瓶';
  if (profile.units.includes('支')) return '支';
  return profile.units[0] ?? 'ml';
}
