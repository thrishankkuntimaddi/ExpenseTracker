// ─── shareHelpers.js ───────────────────────────────────────────────
import { formatAmount, formatDate } from '../../utils/dateHelpers';

/**
 * Format billing session into WhatsApp / plain text readable format
 */
export function formatSessionTextSummary(session) {
  const name = session.name || 'Billing Session';
  const dateStr = session.date ? formatDate(session.date) : '—';
  const statusStr = (session.status || 'closed').toUpperCase();

  const items = (session.items || []).filter(i => i.name?.trim() || parseFloat(i.amount) > 0);
  const received = (session.received || []).filter(r => r.person?.trim() || parseFloat(r.amount) > 0);

  const totalSpent = session.total_spent ?? items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalReceived = session.total_received ?? received.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netBalance = session.net_balance ?? (totalReceived - totalSpent);

  let text = `🧾 *BILLING SESSION: ${name.toUpperCase()}*\n`;
  text += `📅 Date: ${dateStr} | Status: ${statusStr}\n`;
  text += `─────────────────────────\n\n`;

  text += `🛒 *ITEMS PURCHASED*\n`;
  if (items.length === 0) {
    text += `  (No items recorded)\n`;
  } else {
    items.forEach(i => {
      const amt = parseFloat(i.amount) || 0;
      text += `  • ${i.name || 'Item'}: ₹${amt.toFixed(2)}\n`;
    });
  }
  text += `  *Total Spent: ₹${totalSpent.toFixed(2)}*\n\n`;

  text += `👤 *MONEY RECEIVED*\n`;
  if (received.length === 0) {
    text += `  (No received entries)\n`;
  } else {
    received.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      text += `  • ${r.person || 'Person'}: ₹${amt.toFixed(2)}\n`;
    });
  }
  text += `  *Total Received: ₹${totalReceived.toFixed(2)}*\n\n`;

  text += `─────────────────────────\n`;
  const sign = netBalance >= 0 ? '+' : '';
  const netLabel = netBalance > 0 ? '(Profit)' : netBalance < 0 ? '(Loss)' : '(Balanced)';
  text += `💰 *NET BALANCE: ${sign}₹${netBalance.toFixed(2)} ${netLabel}*\n`;
  text += `\nShared via Expense Tracker`;

  return text;
}

/**
 * Generate high-DPI HTML5 Canvas PNG receipt blob for session
 */
export async function generateSessionReceiptBlob(session) {
  return new Promise((resolve, reject) => {
    try {
      const name = session.name || 'Billing Session';
      const dateStr = session.date ? formatDate(session.date) : '—';
      const statusStr = (session.status || 'closed').toUpperCase();

      const items = (session.items || []).filter(i => i.name?.trim() || parseFloat(i.amount) > 0);
      const received = (session.received || []).filter(r => r.person?.trim() || parseFloat(r.amount) > 0);

      const totalSpent = session.total_spent ?? items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
      const totalReceived = session.total_received ?? received.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const netBalance = session.net_balance ?? (totalReceived - totalSpent);

      const scale = 2; // Retina DPI scaling
      const width = 640;
      
      // Calculate dynamic height based on row counts
      const rowCount = Math.max(items.length, received.length, 1);
      const baseHeight = 320;
      const rowHeight = 32;
      const height = Math.max(480, baseHeight + (rowCount * rowHeight));

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // Background card
      ctx.fillStyle = '#0f172a'; // Deep slate background
      ctx.fillRect(0, 0, width, height);

      // Outer border & glow
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // Header Gradient Bar
      const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
      headerGrad.addColorStop(0, '#1e293b');
      headerGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, width, 80);
      
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.lineTo(width, 80);
      ctx.stroke();

      // Brand Icon & Name
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('EXPENSE TRACKER', 24, 28);

      // Session Title
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(name.length > 32 ? name.substring(0, 32) + '…' : name, 24, 56);

      // Date & Status Tag Right Aligned
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(dateStr, width - 24, 30);

      // Status Pill Background
      const statusWidth = 70;
      ctx.fillStyle = statusStr === 'OPEN' || statusStr === 'ACTIVE' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.2)';
      ctx.fillRect(width - 24 - statusWidth, 40, statusWidth, 22);
      ctx.strokeStyle = statusStr === 'OPEN' || statusStr === 'ACTIVE' ? '#38bdf8' : '#64748b';
      ctx.strokeRect(width - 24 - statusWidth, 40, statusWidth, 22);

      ctx.fillStyle = statusStr === 'OPEN' || statusStr === 'ACTIVE' ? '#38bdf8' : '#cbd5e1';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(statusStr, width - 24 - (statusWidth / 2), 54);

      // Reset textAlign
      ctx.textAlign = 'left';

      // Columns Setup
      const colWidth = (width - 64) / 2;
      const leftColX = 24;
      const rightColX = leftColX + colWidth + 16;
      let startY = 105;

      // Section Headers
      // Left: Items Purchased
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('🛒 ITEMS PURCHASED', leftColX, startY);

      // Right: Money Received
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('👤 MONEY RECEIVED', rightColX, startY);

      startY += 16;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(leftColX, startY);
      ctx.lineTo(leftColX + colWidth, startY);
      ctx.moveTo(rightColX, startY);
      ctx.lineTo(rightColX + colWidth, startY);
      ctx.stroke();

      startY += 20;

      // Render Rows
      ctx.font = '13px sans-serif';
      for (let i = 0; i < rowCount; i++) {
        const item = items[i];
        const rec = received[i];

        // Item row
        if (item) {
          ctx.fillStyle = '#cbd5e1';
          const itemName = item.name || 'Unnamed Item';
          ctx.fillText(itemName.length > 18 ? itemName.substring(0, 18) + '…' : itemName, leftColX, startY);
          
          ctx.textAlign = 'right';
          ctx.fillStyle = '#f87171';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(formatAmount(parseFloat(item.amount) || 0), leftColX + colWidth, startY);
          ctx.textAlign = 'left';
          ctx.font = '13px sans-serif';
        }

        // Received row
        if (rec) {
          ctx.fillStyle = '#cbd5e1';
          const recName = rec.person || 'Unnamed Person';
          ctx.fillText(recName.length > 18 ? recName.substring(0, 18) + '…' : recName, rightColX, startY);

          ctx.textAlign = 'right';
          ctx.fillStyle = '#4ade80';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(formatAmount(parseFloat(rec.amount) || 0), rightColX + colWidth, startY);
          ctx.textAlign = 'left';
          ctx.font = '13px sans-serif';
        }

        startY += 26;
      }

      // Column Totals
      startY += 10;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(leftColX, startY);
      ctx.lineTo(leftColX + colWidth, startY);
      ctx.moveTo(rightColX, startY);
      ctx.lineTo(rightColX + colWidth, startY);
      ctx.stroke();

      startY += 22;
      ctx.font = 'bold 13px sans-serif';

      // Left total
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Total Spent:', leftColX, startY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f87171';
      ctx.fillText(formatAmount(totalSpent), leftColX + colWidth, startY);

      // Right total
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Total Received:', rightColX, startY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(formatAmount(totalReceived), rightColX + colWidth, startY);

      // Summary Bar at Bottom
      ctx.textAlign = 'left';
      const summaryY = height - 70;
      const summaryHeight = 48;
      const netIsProfit = netBalance > 0;
      const netIsLoss = netBalance < 0;

      const netBg = netIsProfit ? 'rgba(34, 197, 94, 0.15)' : netIsLoss ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)';
      const netBorder = netIsProfit ? '#22c55e' : netIsLoss ? '#ef4444' : '#64748b';
      const netText = netIsProfit ? '#4ade80' : netIsLoss ? '#f87171' : '#cbd5e1';

      ctx.fillStyle = netBg;
      ctx.fillRect(24, summaryY, width - 48, summaryHeight);
      ctx.strokeStyle = netBorder;
      ctx.strokeRect(24, summaryY, width - 48, summaryHeight);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('NET BALANCE', 38, summaryY + 28);

      ctx.textAlign = 'right';
      ctx.fillStyle = netText;
      ctx.font = 'black 20px sans-serif';
      const netSign = netBalance >= 0 ? '+' : '';
      ctx.fillText(`${netSign}${formatAmount(netBalance)}`, width - 38, summaryY + 31);

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText('Generated with Expense Tracker · Financial Command Center', width / 2, height - 10);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas blob generation failed'));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Copy PNG image blob directly to clipboard
 */
export async function copyImageToClipboard(blob) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error('Clipboard image copy not supported on this browser');
  }
  const item = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}

/**
 * Download PNG image blob
 */
export function downloadImageBlob(blob, filename = 'billing_receipt.png') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share via native Web Share API
 */
export async function shareSessionNative(session, blob) {
  const title = session.name || 'Billing Receipt';
  const text = formatSessionTextSummary(session);

  if (navigator.canShare && blob) {
    const file = new File([blob], `${title.replace(/[^a-z0-9]/gi, '_')}.png`, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return;
    }
  }

  if (navigator.share) {
    await navigator.share({
      title,
      text,
    });
  } else {
    throw new Error('Web Share API is not supported on this browser');
  }
}
