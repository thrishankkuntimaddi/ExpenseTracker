// ─── Scan a receipt or a payment screenshot (Android app) ────────
// The picture is read on the phone (ML Kit) — never uploaded — and the
// name, amount and date fill the form for you to check.
import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { intakeAvailable, readPicture } from '../native/intake';
import { parsePayment } from '../utils/receiptParse';

import { t as tr } from '../i18n';
/* Big camera photos (12 MP) are slow to pass to the phone's reader and can
   fail on the way: shrink to ~1600 px first — still plenty for the text. */
function shrink(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const r = new FileReader();   // the browser can't draw it: send it as it is
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    };
    img.src = url;
  });
}

export default function ScanButton({ onResult }) {
  const camera = useRef(null);
  const gallery = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!intakeAvailable()) return null;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setNote('');
    try {
      const text = await readPicture(await shrink(file));
      const r = parsePayment(text, { image: true });
      if (!text) { setNote(tr('Couldn’t read any text in that picture — try a sharper one, or type it in.')); return; }
      if (!r) { setNote(tr('Couldn’t find an amount in that picture — type it in.')); return; }
      onResult(r);
      setNote(r.name ? `${tr('Read')}: ${r.name} · ${r.amount} — ${tr('check it before saving')}` : `${tr('Read the amount')}: ${r.amount} — ${tr('add what it was for')}`);
    } catch {
      setNote(tr('Couldn’t open that picture.'));
    } finally {
      setBusy(false);
    }
  };

  const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px dashed var(--border-dark)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
  return (
    <div>
      {/* Camera for a receipt; the gallery for a UPI screenshot (capture would force the camera) */}
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={pick} hidden />
      <input ref={gallery} type="file" accept="image/*" onChange={pick} hidden />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" id="add-scan-shot" onClick={() => gallery.current?.click()} disabled={busy} style={btn}>
          {busy ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} {busy ? tr('Reading…') : tr('UPI screenshot')}
        </button>
        <button type="button" id="add-scan" onClick={() => camera.current?.click()} disabled={busy} style={btn}>
          <Camera size={14} /> {tr('Scan a receipt')}
        </button>
      </div>
      {note && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{note}</div>}
    </div>
  );
}
