// ─── UPI pay links ───────────────────────────────────────────────
// upi://pay?pa=<UPI ID>&pn=<name>&am=<amount>&cu=INR&tn=<note> opens any UPI
// app (GPay, PhonePe, Paytm, BHIM …) with everything filled in; the person
// still confirms with their PIN, so nothing is ever paid by the app.
// UPI IDs you've used are remembered in settings.upi = { mine, people: { [name]: id } }.

export const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;
export const isUpiId = (v) => UPI_RE.test(String(v ?? '').trim());
export const personKey = (name) => String(name ?? '').trim().toLowerCase();

/** A UPI ID saved for a person (or yours when `me`). */
export function savedUpi(settings, name, me = false) {
  const u = settings?.upi ?? {};
  return (me ? u.mine : u.people?.[personKey(name)]) ?? '';
}

/** Settings patch that remembers an ID. */
export function rememberUpi(settings, name, id, me = false) {
  const u = settings?.upi ?? {};
  const v = String(id).trim();
  return me ? { upi: { ...u, mine: v } } : { upi: { ...u, people: { ...(u.people ?? {}), [personKey(name)]: v } } };
}

export function upiLink({ id, name, amount, note }) {
  const p = new URLSearchParams();
  p.set('pa', String(id).trim());
  if (name) p.set('pn', String(name).slice(0, 50));
  if (Number(amount) > 0) p.set('am', (Math.round(Number(amount) * 100) / 100).toFixed(2));
  p.set('cu', 'INR');
  if (note) p.set('tn', String(note).slice(0, 80));
  return `upi://pay?${p.toString().replace(/\+/g, '%20')}`;
}

/** The message to send someone so they can pay `toName` (often you). */
export function payRequestMessage({ fromName, toName, id, amount, note, money }) {
  const link = upiLink({ id, name: toName, amount, note });
  return [
    `Hi${fromName ? ` ${fromName}` : ''} — ${money(amount)} to ${toName}${note ? ` for ${note}` : ''}.`,
    '',
    `Pay by UPI: ${id}`,
    `Or tap: ${link}`,
  ].join('\n');
}
