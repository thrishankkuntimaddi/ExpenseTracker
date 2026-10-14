// ─── ShareSummaryModal ────────────────────────────────────────────
// Share a summary two ways: as an image (preview, copy, save, or the phone's
// share sheet with the picture attached) and as text for the group chat.
// Used by Trips and Billings; the caller builds the text and the image.
import { useEffect, useState } from 'react';
import { Copy, Check, Download, Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import ModalShell from './ModalShell';
import { copyImageToClipboard, downloadImageBlob } from '../features/external/shareHelpers';

export default function ShareSummaryModal({ title, subtitle, text, makeImage, filename = 'summary', onClose }) {
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState('');   // which button just worked
  const [note, setNote] = useState('');
  const file = `${filename.replace(/[^\w-]+/g, '_')}.png`;

  useEffect(() => {
    let live = true, made = '';
    makeImage().then((b) => {
      if (!live) return;
      made = URL.createObjectURL(b);
      setBlob(b); setUrl(made);
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [makeImage]);

  const flash = (what, msg) => { setDone(what); setNote(msg ?? ''); setTimeout(() => { setDone(''); setNote(''); }, 1800); };
  async function copyText() {
    try { await navigator.clipboard.writeText(text); flash('text', 'Text copied — paste it in the chat.'); } catch { flash('', 'Copy blocked by the browser.'); }
  }
  async function copyImage() {
    if (!blob) return;
    try { await copyImageToClipboard(blob); flash('image', 'Image copied.'); }
    catch { downloadImageBlob(blob, file); flash('save', 'This browser can’t copy images — saved it instead.'); }
  }
  function save() { if (blob) { downloadImageBlob(blob, file); flash('save', 'Image saved.'); } }
  async function share() {
    try {
      const f = blob ? new File([blob], file, { type: 'image/png' }) : null;
      if (f && navigator.canShare?.({ files: [f] })) await navigator.share({ title, text, files: [f] });
      else await navigator.share({ title, text });
    } catch (err) { if (err?.name !== 'AbortError') copyText(); }
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose} maxWidth={540}
      footer={<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, width: '100%' }}>
        <Btn onClick={copyText} Icon={done === 'text' ? Check : Copy}>Copy text</Btn>
        <Btn onClick={copyImage} Icon={done === 'image' ? Check : ImageIcon} disabled={!blob}>Copy image</Btn>
        <Btn onClick={save} Icon={done === 'save' ? Check : Download} disabled={!blob}>Save image</Btn>
        {canShare && <Btn onClick={share} Icon={Send} primary>Share…</Btn>}
      </div>}
    >
      {note && <div role="status" style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{note}</div>}
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#0A0C11', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {url ? <img src={url} alt={`${title} as an image`} style={{ width: '100%', display: 'block' }} />
          : failed ? <span style={{ color: '#F87171', fontSize: 12, padding: 20 }}>Couldn’t draw the image — the text below has everything.</span>
          : <span style={{ color: '#A3ABBD', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={16} className="spin" /> Drawing the image…</span>}
      </div>
      <textarea readOnly value={text} rows={8} aria-label="Text summary"
        style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
    </ModalShell>
  );
}

function Btn({ children, onClick, Icon, disabled, primary }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      padding: '10px 12px', borderRadius: 11, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      background: primary ? 'var(--accent)' : 'var(--surface2)', color: primary ? '#fff' : 'var(--text)',
      border: primary ? 'none' : '1px solid var(--border)',
    }}><Icon size={14} /> {children}</button>
  );
}
