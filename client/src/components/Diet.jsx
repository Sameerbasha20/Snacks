import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';

const KEY = 'diet';
const EVENT = 'diet-change';
export const DIETS = [
  ['all', 'All'],
  ['veg', 'Veg'],
  ['nonveg', 'Non-veg'],
];

/** The customer's veg / non-veg choice, shared by the home page and the menu and kept between visits. */
export function useDiet() {
  const read = () => {
    const v = localStorage.getItem(KEY);
    return DIETS.some(([id]) => id === v) ? v : 'all';
  };
  const [diet, setDietState] = useState(read);
  useEffect(() => {
    const sync = () => setDietState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const setDiet = useCallback((v) => {
    localStorage.setItem(KEY, v);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [diet, setDiet];
}

// Drinks go with any meal, so they show under Veg and Non-veg alike.
export const matchesDiet = (diet, item) =>
  diet === 'all' || item.category === 'drinks' || (diet === 'veg' ? item.is_veg !== false : item.is_veg === false);

/** The standard Indian food mark: green square with a dot for veg, red square with a triangle for non-veg. */
export function VegMark({ veg, size = 14, className = '', decorative = false }) {
  const color = veg ? '#1e8a3c' : '#b3261e';
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={`shrink-0 ${className}`} {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': veg ? 'Veg' : 'Non-veg' })}>
      <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="1.5" fill="#fff" stroke={color} strokeWidth="1.5" />
      {veg ? <circle cx="7" cy="7" r="3.2" fill={color} /> : <path d="M7 3.4 10.6 10H3.4Z" fill={color} />}
    </svg>
  );
}

/** Drinks get a chilled emoji instead of the veg / non-veg mark; everything else gets the mark. */
export function DishMark({ item, size = 14, className = '' }) {
  if (item.category === 'drinks') {
    return (
      <span className={`shrink-0 leading-none ${className}`} style={{ fontSize: size }} role="img" aria-label="Drink">
        🧊
      </span>
    );
  }
  return <VegMark veg={item.is_veg !== false} size={size} className={className} />;
}

/** All / Veg / Non-veg switch. `id` keeps the sliding pill separate when two switches are on one page. */
export function DietFilter({ diet, onChange, id = 'diet', className = '' }) {
  return (
    <div role="radiogroup" aria-label="Show veg or non-veg" className={`inline-flex rounded-full border border-line bg-surface p-1 ${className}`}>
      {DIETS.map(([value, label]) => {
        const on = diet === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(value)}
            className={`relative flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? 'text-ink' : 'text-ink/60 hover:text-ink'}`}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-full border border-ink/15 bg-paper shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 34 }}
              />
            )}
            {value !== 'all' && <VegMark veg={value === 'veg'} size={13} className="relative" decorative />}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
