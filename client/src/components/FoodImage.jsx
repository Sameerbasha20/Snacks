import { useState } from 'react';

/** Food photo with a quiet fallback (the item's initial) when there is no photo or it fails to load. */
export default function FoodImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-line/60 text-2xl font-extrabold text-muted ${className}`} aria-hidden="true">
        {alt?.[0] ?? ''}
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
