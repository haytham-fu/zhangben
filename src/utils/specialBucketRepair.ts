import type { AppState } from '../types';

/** One-time correction for older entries saved under a special category but a basic bucket. */
export function repairLegacySpecialBuckets(state: AppState): AppState {
  if (state.settings.specialBucketRepairVersion === 1) return state;
  const specialCategories = new Set(state.categories
    .filter((category) => category.bucket === 'special')
    .map((category) => category.id));
  const transactions = state.transactions.map((tx) => {
    if (tx.type !== 'expense' || tx.kind === 'topup' || tx.isGroceryPurchase ||
        tx.dailyFixedRuleId || tx.bucket !== 'basic' ||
        !(tx.isMonthly || specialCategories.has(tx.categoryId))) return tx;
    return { ...tx, bucket: 'special' as const };
  });
  return {
    ...state,
    transactions,
    settings: { ...state.settings, specialBucketRepairVersion: 1 },
  };
}
