// ─── Share card (PNG) ─────────────────────────────────────────────
// One renderer for every "share as image" in the app (Trips, Billings):
// a header, a row of headline numbers, then titled sections of rows. The
// canvas grows to fit — nothing is cut off; very long lists end with
// "+N more" (the text summary next to it always has everything).
//
// card = {
//   kicker, title, subtitle, badge: { text, tone },
//   hero: [{ label, value, tone? }],
//   sections: [{ title, rows: [{ left, sub?, right, tone?, dim? }], empty?, total?: { left, right, tone? } }],
//   footer,
// }
const W = 720, PAD = 32, SCALE = 2, MAX_ROWS = 40;
// Light Liquid Glass, like the app: Apple grey with a soft wallpaper tint,
// white cards, graphite text; colour only for money in / out.
const C = {
  bg: '#EEF0F6', card: '#FFFFFF', line: '#E5E5EA', text: '#0A0A0C', sub: '#6C6C70', muted: '#8E8E93',
  expense: '#FF3B30', income: '#1E9E4A', accent: '#3A3A3C', gold: '#D97A00',
};
const FONT = '"Inter", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const tone = (t) => C[t] ?? C.text;

function fit(ctx, text, max) {
  const s = String(text ?? '');
  if (ctx.measureText(s).width <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + '…';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const rowH = (r) => (r.sub ? 44 : 30);
function layout(card) {
  let h = PAD + 104;                         // header
  if (card.hero?.length) h += 92;            // headline tiles
  (card.sections ?? []).forEach((s) => {
    const rows = s.rows.slice(0, MAX_ROWS);
    h += 22 + 34;                            // gap + section title
    h += rows.length ? rows.reduce((t, r) => t + rowH(r), 0) : 30;
    if (s.rows.length > MAX_ROWS) h += 26;
    if (s.total) h += 38;
    h += 12;
  });
  return h + 56;                             // footer
}

/** Draw the card; resolves to a PNG Blob. */
export function renderShareCard(card) {
  return new Promise((resolve, reject) => {
    try {
      const H = layout(card);
      const canvas = document.createElement('canvas');
      canvas.width = W * SCALE; canvas.height = H * SCALE;
      const ctx = canvas.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.textBaseline = 'alphabetic';

      // Background: the app's wallpaper — Apple grey with soft sky / peach / mint light
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      for (const [x, yy, r, col] of [[40, 0, 420, '122,178,255'], [W, 120, 380, '255,184,150'], [0, H, 420, '132,226,196']]) {
        const g = ctx.createRadialGradient(x, yy, 10, x, yy, r);
        g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      // Header
      let y = PAD + 14;
      ctx.fillStyle = C.accent; ctx.font = `700 11px ${FONT}`;
      ctx.fillText((card.kicker ?? 'EXPENSE TRACKER').toUpperCase(), PAD, y);
      if (card.badge) {
        ctx.font = `800 10.5px ${FONT}`;
        const bw = ctx.measureText(card.badge.text.toUpperCase()).width + 20;
        roundRect(ctx, W - PAD - bw, y - 14, bw, 22, 11);
        ctx.fillStyle = card.badge.tone === 'income' ? 'rgba(52,199,89,0.14)' : card.badge.tone === 'expense' ? 'rgba(255,59,48,0.12)' : 'rgba(120,120,128,0.14)';
        ctx.fill();
        ctx.fillStyle = tone(card.badge.tone ?? 'accent'); ctx.textAlign = 'center';
        ctx.fillText(card.badge.text.toUpperCase(), W - PAD - bw / 2, y + 1); ctx.textAlign = 'left';
      }
      y += 36;
      ctx.fillStyle = C.text; ctx.font = `800 28px ${FONT}`;
      ctx.fillText(fit(ctx, card.title, W - PAD * 2), PAD, y);
      y += 24;
      ctx.fillStyle = C.sub; ctx.font = `500 13px ${FONT}`;
      ctx.fillText(fit(ctx, card.subtitle ?? '', W - PAD * 2), PAD, y);
      y += 30;

      // Headline tiles
      if (card.hero?.length) {
        const n = card.hero.length, gap = 10, tw = (W - PAD * 2 - gap * (n - 1)) / n;
        card.hero.forEach((h, i) => {
          const x = PAD + i * (tw + gap);
          roundRect(ctx, x, y, tw, 74, 14); ctx.fillStyle = C.card; ctx.fill();
          ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = C.muted; ctx.font = `700 10px ${FONT}`;
          ctx.fillText(fit(ctx, h.label.toUpperCase(), tw - 28), x + 14, y + 24);
          ctx.fillStyle = tone(h.tone); ctx.font = `800 21px ${FONT}`;
          ctx.fillText(fit(ctx, h.value, tw - 28), x + 14, y + 54);
        });
        y += 92;
      }

      // Sections
      (card.sections ?? []).forEach((s) => {
        y += 22;
        const rows = s.rows.slice(0, MAX_ROWS);
        const bodyH = (rows.length ? rows.reduce((t, r) => t + rowH(r), 0) : 30) + (s.rows.length > MAX_ROWS ? 26 : 0) + (s.total ? 38 : 0) + 12;
        roundRect(ctx, PAD - 12, y - 4, W - PAD * 2 + 24, 34 + bodyH, 16);
        ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.sub; ctx.font = `800 11px ${FONT}`;
        ctx.fillText(s.title.toUpperCase(), PAD + 4, y + 20);
        y += 34;
        if (!rows.length) {
          ctx.fillStyle = C.muted; ctx.font = `500 13px ${FONT}`;
          ctx.fillText(s.empty ?? 'Nothing yet', PAD + 4, y + 18); y += 30;
        }
        rows.forEach((r, i) => {
          const h = rowH(r);
          if (i) { ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(PAD + 4, y); ctx.lineTo(W - PAD - 4, y); ctx.stroke(); }
          ctx.font = `800 14px ${FONT}`;
          const rw = ctx.measureText(r.right ?? '').width;
          ctx.fillStyle = tone(r.tone); ctx.textAlign = 'right';
          ctx.fillText(r.right ?? '', W - PAD - 4, y + 20); ctx.textAlign = 'left';
          ctx.fillStyle = r.dim ? C.muted : C.text; ctx.font = `600 13.5px ${FONT}`;
          ctx.fillText(fit(ctx, r.left, W - PAD * 2 - rw - 24), PAD + 4, y + 20);
          if (r.sub) { ctx.fillStyle = C.muted; ctx.font = `500 11.5px ${FONT}`; ctx.fillText(fit(ctx, r.sub, W - PAD * 2 - rw - 24), PAD + 4, y + 36); }
          y += h;
        });
        if (s.rows.length > MAX_ROWS) {
          ctx.fillStyle = C.muted; ctx.font = `600 12px ${FONT}`;
          ctx.fillText(`+${s.rows.length - MAX_ROWS} more — see the text summary`, PAD + 4, y + 18); y += 26;
        }
        if (s.total) {
          ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(PAD + 4, y + 4); ctx.lineTo(W - PAD - 4, y + 4); ctx.stroke();
          ctx.fillStyle = C.sub; ctx.font = `700 13px ${FONT}`; ctx.fillText(s.total.left, PAD + 4, y + 26);
          ctx.fillStyle = tone(s.total.tone); ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'right';
          ctx.fillText(s.total.right, W - PAD - 4, y + 26); ctx.textAlign = 'left';
          y += 38;
        }
        y += 12;
      });

      ctx.fillStyle = C.muted; ctx.font = `500 11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(card.footer ?? 'Made with Expense Tracker', W / 2, H - 24);

      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the image'))), 'image/png');
    } catch (err) { reject(err); }
  });
}
