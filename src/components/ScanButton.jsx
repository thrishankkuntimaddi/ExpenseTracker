// ─── Scan a receipt or a payment screenshot (Android app) ────────
// The picture is read on the phone (ML Kit) — never uploaded — and the
// name, amount and date fill the form for you to check.
import { useRef, useState } from 'react';
import { ScanLine, Loader2 } from 'lucide-react';
import { intakeAvailable, readPicture } from '../native/intake';
import { parsePayment } from '../utils/receiptParse';

export default function ScanButton({ onResult }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!intakeAvailable()) return null;

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setNote('');
    const reader = new FileReader();
    reader.onload = async () => {
      const text = await readPicture(String(reader.result));
      const r = parsePayment(text, { image: true });
      setBusy(false);
      if (!r) { setNote('Couldn’t find an amount in that picture — type it in.'); return; }
      onResult(r);
      setNote(r.name ? `Read: ${r.name} · ${r.amount} — check it before saving` : `Read the amount: ${r.amount} — add what it was for`);
    };
    reader.onerror = () => { setBusy(false); setNote('Couldn’t open that picture.'); };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={pick} hidden />
      <button type="button" id="add-scan" onClick={() => input.current?.click()} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px dashed var(--border-dark)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        {busy ? <Loader2 size={14} className="spin" /> : <ScanLine size={14} />} {busy ? 'Reading…' : 'Scan a receipt or UPI screenshot'}
      </button>
      {note && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{note}</div>}
    </div>
  );
}
