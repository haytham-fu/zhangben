import { useEffect, useMemo, useState } from 'react';
import type { BgMotion, ThemePalette } from '../types';

/** Apply palette + motion to <html>; respect prefers-reduced-motion. */
export function useThemeAppearance(palette: ThemePalette, bgMotion: BgMotion) {
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const effectiveMotion: BgMotion = reduceMotion ? 'static' : bgMotion;
  const adviceAnimated = effectiveMotion === 'dynamic';

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
    root.dataset.bgMotion = effectiveMotion;
    return () => {
      delete root.dataset.palette;
      delete root.dataset.bgMotion;
    };
  }, [palette, effectiveMotion]);

  return useMemo(
    () => ({ reduceMotion, effectiveMotion, adviceAnimated }),
    [reduceMotion, effectiveMotion, adviceAnimated],
  );
}
