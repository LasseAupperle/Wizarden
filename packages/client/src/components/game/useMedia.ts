import { useEffect, useState } from 'react';

function useMediaQuery(query: string): boolean {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** PC / large-tablet game table (spec: wide layout from 1024px). */
export const WIDE_QUERY = '(min-width: 1024px)';
export const useIsWide = (): boolean => useMediaQuery(WIDE_QUERY);

/** Touch-first device: hand cards lift on the first tap and play on the second. */
export const useCoarsePointer = (): boolean => useMediaQuery('(pointer: coarse)');

/** Width of an element, kept up to date (for fitting the fanned hand). */
export function useElementWidth(el: HTMLElement | null): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}
