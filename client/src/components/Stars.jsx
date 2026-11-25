import { useState } from 'react';
import Icon from './Icon';

/** Compact average rating for a dish, e.g. "4.6 (12)". Hidden until someone has rated it. */
export function RatingBadge({ avg, count, className = '' }) {
  if (!count) return null;
  return (
    <span className={`num inline-flex items-center gap-1 text-sm ${className}`} title={`${avg} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`}>
      <Icon name="star" size={14} filled className="text-saffron" />
      <span className="font-semibold text-ink">{avg.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

const WORDS = ['', 'Poor', 'Not great', 'Good', 'Very good', 'Loved it'];

/** 1–5 star picker; arrow keys work because it's a radio group. */
export function StarInput({ value, onChange, label }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} onMouseEnter={() => setHover(n)} className="cursor-pointer p-0.5">
            <input type="radio" name={label} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <Icon
              name="star"
              size={26}
              filled={n <= shown}
              strokeWidth={1.6}
              className={`rounded transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${n <= shown ? 'text-saffron' : 'text-line'}`}
            />
            <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}</span>
          </label>
        ))}
      </div>
      <span className="w-20 text-sm text-ink/65">{WORDS[shown]}</span>
    </div>
  );
}
