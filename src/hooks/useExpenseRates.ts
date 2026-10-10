import { useEffect, useState } from 'react';
import type { Currency, Settings } from '../types';
import { getRate } from '../utils/currency';
import { resolveRate, type ResolvedRate } from '../utils/fx';

type RateSnapshot = {
  key: string;
  rates: Partial<Record<Currency, ResolvedRate>>;
};

/** Resolve each selected currency once; previews and saved values use the same rate. */
export function useExpenseRates(currencies: Currency[], settings: Settings) {
  const selected = [...new Set(currencies.filter((c) => c !== 'RMB'))].sort().join(',');
  const key = `${selected}|${settings.fxRateMode}|${JSON.stringify(settings.fixedRates)}|${settings.liveRatesUpdatedAt ?? ''}|${JSON.stringify(settings.liveRates)}`;
  const [snapshot, setSnapshot] = useState<RateSnapshot>({ key: '', rates: {} });

  useEffect(() => {
    if (settings.fxRateMode !== 'live' || !selected) return;
    let cancelled = false;
    const codes = selected.split(',') as Currency[];
    void Promise.all(codes.map(async (code) => [code, await resolveRate(code, settings)] as const))
      .then((pairs) => {
        if (cancelled) return;
        setSnapshot({ key, rates: Object.fromEntries(pairs) });
      });
    return () => { cancelled = true; };
  }, [key, selected, settings]);

  const ready = settings.fxRateMode !== 'live' || !selected || snapshot.key === key;
  const rateFor = (currency: Currency) =>
    currency === 'RMB' ? 1 : settings.fxRateMode === 'live' && snapshot.key === key
      ? snapshot.rates[currency]?.rate ?? getRate(currency, settings)
      : getRate(currency, settings);
  const rateNoteFor = (currency: Currency) => {
    if (currency === 'RMB') return '人民币无需换算';
    if (settings.fxRateMode === 'live' && !ready) return '实时汇率读取中…';
    if (settings.fxRateMode === 'live') return snapshot.rates[currency]?.note ?? '按可用汇率换算';
    return `固定汇率 1 ${currency} = ${rateFor(currency)} RMB`;
  };
  return { ready, rateFor, rateNoteFor };
}
