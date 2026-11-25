import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, fmtDay, money } from '../lib/api';
import Icon from '../components/Icon';

export default function Rewards() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/me/rewards')
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, []);

  if (!data)
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-10">
        <div className="shimmer h-12 w-2/3 rounded" />
        <div className="shimmer h-48 rounded-xl" />
      </div>
    );

  const amt = money(data.amount);
  const link = `${window.location.origin}/register?ref=${data.code}`;
  const message = `I order my snacks ahead at Snack Shack. Sign up with my code ${data.code} and get ${amt} off your first order: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed. Press and hold the code to copy it.');
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Snack Shack', text: message });
      } catch {
        /* closed the share sheet */
      }
    } else copy();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-32 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">
        Give {amt}, get {amt}
      </h1>
      <p className="mt-3 max-w-lg text-ink/70">
        Share your code with a friend. They get {amt} off when they sign up with it, and you get {amt} when they collect their first order.
      </p>

      <section className="mt-8 rounded-xl bg-ink p-6 text-paper sm:p-8">
        <p className="text-sm text-paper/60">Your code</p>
        <p className="num mt-1 text-[clamp(2rem,10.5vw,3.75rem)] leading-tight font-extrabold tracking-[0.06em] break-all text-saffron select-all">{data.code}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={share} className="btn btn-primary">
            <Icon name="share" size={16} /> Share
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn border-[1.5px] border-paper/30 text-paper hover:border-paper">
            Send on WhatsApp
          </a>
          <button onClick={copy} className="btn btn-quiet !text-paper/80 hover:!text-paper">
            <Icon name="copy" size={16} /> Copy link
          </button>
        </div>
      </section>

      <section className="mt-10 flex items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-xl">Your credit</h2>
          <p className="text-sm text-ink/65">Taken off your next order at checkout.</p>
        </div>
        <p className="num text-3xl font-extrabold">{money(data.balance)}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Friends you've invited</h2>
        {data.friends.length === 0 ? (
          <p className="mt-2 text-ink/70">No one yet. Share your code and you'll see friends here when they sign up.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {data.friends.map((f, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-3">
                <span className="font-semibold">{f.name}</span>
                <span className={`text-sm ${f.rewarded ? 'font-semibold' : 'text-ink/65'}`}>
                  {f.rewarded ? `You earned ${amt}` : 'Signed up, waiting for their first pickup'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl">Credit history</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {data.history.map((h, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block">{h.order_id ? <Link to={`/orders/${h.order_id}`} className="underline-offset-4 hover:underline">{h.reason}</Link> : h.reason}</span>
                  <span className="text-sm text-muted">{fmtDay(h.created_at)}</span>
                </span>
                <span className={`num shrink-0 font-semibold ${h.amount < 0 ? 'text-ink/65' : ''}`}>
                  {h.amount < 0 ? '−' : '+'}
                  {money(Math.abs(h.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
