import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

/** Escape text for the printable HTML page. */
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default function QrCode() {
  const [qr, setQr] = useState(null);
  const [url, setUrl] = useState('');

  const load = useCallback((u) => {
    const query = u ? `?url=${encodeURIComponent(u)}` : '';
    api(`/admin/qr${query}`)
      .then((d) => {
        setQr(d);
        setUrl(d.url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  const print = () => {
    const w = window.open('', '_blank', 'width=640,height=860');
    if (!w) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(qr.shop_name)} QR code</title>
      <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;800&display=swap" rel="stylesheet">
      <style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
      body{margin:0;font-family:'Schibsted Grotesk',sans-serif;background:#F5F1EA;color:#1C1A17;display:flex;justify-content:center}
      .sheet{width:520px;padding:56px 48px;text-align:left}
      h1{font-size:64px;line-height:.95;letter-spacing:-.03em;margin:0 0 18px;font-weight:800}
      p{font-size:20px;margin:0;line-height:1.4}
      .qr{background:#1C1A17;border-radius:18px;padding:28px;margin:36px 0 28px}
      .qr img{width:100%;display:block;border-radius:6px}
      .foot{display:flex;justify-content:space-between;border-top:2px solid #1C1A17;padding-top:14px;font-weight:800}
      .foot span:last-child{color:#E8772E}</style></head>
      <body><div class="sheet"><h1>Order before you queue.</h1>
      <p>Scan to order from your phone. Pick a time and collect it hot from this counter.</p>
      <div class="qr"><img src="${qr.dataUrl}" alt=""></div>
      <div class="foot"><span>${esc(qr.shop_name)}</span><span>Order 1 hour ahead</span></div></div>
      </body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Print from here: the popup inherits our security policy, which blocks inline scripts inside it.
    setTimeout(() => w.print(), 700);
  };

  return (
    <div>
      <h1 className="text-4xl">QR code</h1>
      <p className="mt-2 max-w-xl text-ink/70">
        Print it and put it at the counter. Scanning it opens this website. Phones must be able to reach the address below: your shop Wi-Fi address while
        testing, or your own domain once the site is online.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl bg-ink p-5">
          {qr ? <img src={qr.dataUrl} alt={`QR code that opens ${qr.url}`} className="w-full rounded-md" /> : <div className="aspect-square rounded-md bg-white/10" />}
          <p className="mt-3 text-sm break-all text-paper/70">{qr?.url}</p>
        </div>

        <div className="max-w-md space-y-4">
          <label className="block">
            <span className="label">Address the QR code opens</span>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => load(url)} className="btn btn-outline">
              Update QR code
            </button>
            <a href={qr?.dataUrl} download="snack-shack-qr.png" className="btn btn-outline">
              Download image
            </a>
            <button onClick={print} disabled={!qr} className="btn btn-dark">
              Print poster
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
