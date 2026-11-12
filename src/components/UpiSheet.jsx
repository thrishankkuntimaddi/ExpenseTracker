// ─── Settle by UPI ───────────────────────────────────────────────
// "A pays B ₹X": open a UPI app with B's UPI ID and the amount filled in
// (on this phone), show a QR to scan (from a computer), or send A the pay
// link. The UPI app asks for the PIN — this app never moves money; tap
// "Paid" afterwards to record it.
import { useEffect, useState } from 'react';
import { Copy, Share2, Smartphone, Check } from 'lucide-react';
import ModalShell from './ModalShell';
import { useShell } from '../app/shellContext';
import { fieldStyle } from './formTokens';
import { isUpiId, savedUpi, rememberUpi, upiLink, payRequestMessage } from '../utils/upi';
import { formatMoneyCompact } from '../utils/money';
import { isNative } from '../native';

const isPhone = () => isNative || (typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent));

/**
 * @param fromName  who pays
 * @param toName    who gets paid
 * @param toIsMe    the money comes to you (your own UPI ID)
 * @param fromIsMe  you are paying
 */
export default function UpiSheet({ fromName, toName, amount, note, toIsMe = false, fromIsMe = false, onClose, recordWith = 'Paid' }) {
  const shell = useShell();
  const settings = shell?.settings;
  const [id, setId] = useState(() => savedUpi(settings, toName, toIsMe));
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState('');
  const valid = isUpiId(id);
  const link = valid ? upiLink({ id, name: toIsMe ? (shell?.user?.displayName || toName) : toName, amount, note }) : null;
  const phone = isPhone();

  useEffect(() => {
    if (!link || phone) return undefined;
    let live = true;
    import('qrcode').then((QR) => QR.toDataURL(link, { margin: 1, width: 300, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } }))
      .then((url) => { if (live) setQr(url); }, () => {});
    return () => { live = false; };
  }, [link, phone]);

  const remember = () => { if (valid && id.trim() !== savedUpi(settings, toName, toIsMe)) shell?.patchSettings?.(rememberUpi(settings, toName, id, toIsMe)); };
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500); } catch { /* blocked */ } remember(); };
  const message = () => payRequestMessage({ fromName: fromIsMe ? '' : fromName, toName: toIsMe ? 'me' : toName, id, amount, note, money: formatMoneyCompact });
  const share = async () => {
    remember();
    if (navigator.share) { try { await navigator.share({ title: 'Pay by UPI', text: message() }); } catch { /* cancelled */ } } else copy(message(), 'msg');
  };

  const btn = (primary) => ({ flex: 1, minWidth: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 14px', border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--income)' : 'transparent', color: primary ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' });

  return (
    <ModalShell title="Settle by UPI" subtitle={`${fromIsMe ? 'You pay' : `${fromName} pays`} ${toIsMe ? 'you' : toName} · ${formatMoneyCompact(amount)}`} onClose={onClose} maxWidth={440}>
      <label htmlFor="upi-id" style={{ display: 'block', fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {toIsMe ? 'Your UPI ID' : `${toName}’s UPI ID`}
      </label>
      <input id="upi-id" value={id} onChange={(e) => setId(e.target.value.replace(/\s/g, ''))} onBlur={remember} placeholder="name@okhdfcbank" autoCapitalize="none" autoComplete="off" inputMode="email"
        style={{ ...fieldStyle, fontSize: 15, borderColor: id && !valid ? 'var(--expense)' : undefined }} />
      <div style={{ fontSize: 11, color: id && !valid ? 'var(--expense)' : 'var(--text-muted)', marginTop: 5 }}>
        {id && !valid ? 'That doesn’t look like a UPI ID (something@bank).' : 'Saved for next time. Find it in any UPI app under your profile.'}
      </div>

      {valid && (
        <>
          {!phone && qr && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <img id="upi-qr" src={qr} alt="UPI QR code" width={180} height={180} style={{ borderRadius: 12, background: '#fff', padding: 6 }} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{fromIsMe ? 'Scan with any UPI app on your phone' : `${fromName} can scan this to pay`}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {phone && (fromIsMe || !toIsMe) && (
              <a id="upi-open" href={link} onClick={remember} style={btn(true)}><Smartphone size={15} /> Open UPI app</a>
            )}
            {!fromIsMe && (
              <button id="upi-share" onClick={share} style={btn(!phone || toIsMe)}><Share2 size={15} /> {copied === 'msg' ? 'Copied' : `Send ${fromName} the link`}</button>
            )}
            <button id="upi-copy" onClick={() => copy(id.trim(), 'id')} style={btn(false)}>{copied === 'id' ? <Check size={15} /> : <Copy size={15} />} {copied === 'id' ? 'Copied' : 'Copy UPI ID'}</button>
          </div>
        </>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: '14px 0 0' }}>
        The UPI app asks for the PIN — nothing is paid from here. Once it’s done, tap <strong>{recordWith}</strong> to record it.
      </p>
    </ModalShell>
  );
}
