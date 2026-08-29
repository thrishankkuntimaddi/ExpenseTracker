import { useState, useEffect, useRef } from 'react';
import { Share2, Copy, Download, Check, X, Image as ImageIcon, Loader2, Send } from 'lucide-react';
import {
  formatSessionTextSummary,
  generateSessionReceiptBlob,
  copyImageToClipboard,
  downloadImageBlob,
  shareSessionNative,
} from './shareHelpers';

export default function ShareBillingModal({ session, onClose }) {
  const [loadingImage, setLoadingImage] = useState(true);
  const [imageBlob, setImageBlob]       = useState(null);
  const [imageUrl, setImageUrl]         = useState('');
  const [copiedText, setCopiedText]     = useState(false);
  const [copiedImage, setCopiedImage]   = useState(false);
  const [downloaded, setDownloaded]     = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const textSummary = formatSessionTextSummary(session);

  useEffect(() => {
    let active = true;
    setLoadingImage(true);

    generateSessionReceiptBlob(session)
      .then(blob => {
        if (!active) return;
        setImageBlob(blob);
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setLoadingImage(false);
      })
      .catch(err => {
        console.error('Failed to generate receipt image:', err);
        if (active) setLoadingImage(false);
      });

    return () => {
      active = false;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [session]);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(textSummary);
      setCopiedText(true);
      showToast('Text summary copied to clipboard!');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      showToast('Failed to copy text.');
    }
  }

  async function handleCopyImage() {
    if (!imageBlob) return;
    try {
      await copyImageToClipboard(imageBlob);
      setCopiedImage(true);
      showToast('Receipt image copied to clipboard!');
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.warn('Image clipboard copy failed:', err);
      // Fallback: download if copy isn't supported
      downloadImageBlob(imageBlob, `${session.name || 'billing'}_receipt.png`);
      showToast('Browser does not support direct image copy. Downloaded PNG instead!');
    }
  }

  function handleDownloadImage() {
    if (!imageBlob) return;
    downloadImageBlob(imageBlob, `${(session.name || 'billing').replace(/\s+/g, '_')}_receipt.png`);
    setDownloaded(true);
    showToast('Receipt PNG downloaded!');
    setTimeout(() => setDownloaded(false), 2000);
  }

  async function handleNativeShare() {
    try {
      await shareSessionNative(session, imageBlob);
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast('Native share unavailable, copied text instead!');
        handleCopyText();
      }
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1600,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, animation: 'fadeIn 0.15s ease',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1.5px solid var(--external-border)',
        borderRadius: 20, maxWidth: 540, width: '100%', maxHeight: '90vh',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--accent-border)',
            }}>
              <Share2 size={17} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                Share Billing Session
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {session.name || 'Unnamed Session'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--surface)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', transition: 'all 0.15s',
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Modal Content / Preview Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Toast Banner */}
          {toastMessage && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, background: 'var(--accent)',
              color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center',
              boxShadow: 'var(--shadow-sm)', animation: 'fadeIn 0.15s ease',
            }}>
              {toastMessage}
            </div>
          )}

          {/* Image Receipt Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <ImageIcon size={14} /> Receipt Graphic Card
              </div>
              {imageUrl && (
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>High DPI Image</span>
              )}
            </div>

            <div style={{
              borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden',
              background: '#0f172a', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {loadingImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#94a3b8', padding: 30 }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Rendering receipt card…</span>
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Billing Receipt"
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 13 }}
                />
              ) : (
                <div style={{ color: '#f87171', fontSize: 12, padding: 20 }}>
                  Failed to generate image preview.
                </div>
              )}
            </div>
          </div>

          {/* Text Summary Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Copy size={14} /> Text Summary
              </div>
            </div>
            <textarea
              readOnly
              value={textSummary}
              rows={5}
              style={{
                width: '100%', padding: 12, borderRadius: 12, fontSize: 12, fontFamily: 'monospace',
                background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
                color: 'var(--text)', outline: 'none', resize: 'none', lineHeight: '1.5',
              }}
            />
          </div>
        </div>

        {/* Modal Action Footer */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface2)', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10,
        }}>
          <button
            onClick={handleCopyText}
            style={{
              padding: '10px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
              background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, transition: 'all 0.15s',
            }}
          >
            {copiedText ? <Check size={14} style={{ color: 'var(--income)' }} /> : <Copy size={14} />}
            {copiedText ? 'Copied Text!' : 'Copy Text'}
          </button>

          <button
            onClick={handleCopyImage}
            disabled={loadingImage || !imageBlob}
            style={{
              padding: '10px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
              background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
              cursor: loadingImage ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: loadingImage ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {copiedImage ? <Check size={14} style={{ color: 'var(--income)' }} /> : <ImageIcon size={14} />}
            {copiedImage ? 'Copied Image!' : 'Copy Image'}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={loadingImage || !imageBlob}
            style={{
              padding: '10px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
              background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
              cursor: loadingImage ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: loadingImage ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {downloaded ? <Check size={14} /> : <Download size={14} />}
            {downloaded ? 'Downloaded!' : 'Save Image'}
          </button>

          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              style={{
                padding: '10px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
                background: 'var(--accent)', color: '#fff', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, transition: 'all 0.15s',
              }}
            >
              <Send size={14} /> Share…
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
