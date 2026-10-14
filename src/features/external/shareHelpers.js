// ─── shareHelpers.js ───────────────────────────────────────────────
import { formatAmount, formatDate } from '../../utils/dateHelpers';
import { renderShareCard } from '../../utils/shareCard';

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
      text += `  • ${i.name || 'Item'}: ${formatAmount(amt)}\n`;
    });
  }
  text += `  *Total Spent: ${formatAmount(totalSpent)}*\n\n`;

  text += `👤 *MONEY RECEIVED*\n`;
  if (received.length === 0) {
    text += `  (No received entries)\n`;
  } else {
    received.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      text += `  • ${r.person || 'Person'}: ${formatAmount(amt)}\n`;
    });
  }
  text += `  *Total Received: ${formatAmount(totalReceived)}*\n\n`;

  text += `─────────────────────────\n`;
  const sign = netBalance >= 0 ? '+' : '';
  const netLabel = netBalance > 0 ? '(Profit)' : netBalance < 0 ? '(Loss)' : '(Balanced)';
  text += `💰 *NET BALANCE: ${sign}${formatAmount(netBalance)} ${netLabel}*\n`;
  text += `\nShared via Expense Tracker`;

  return text;
}

/** The billing as a share card: totals, every item, everyone who paid back, the net. */
export function billingCard(session) {
  const items = (session.items || []).filter(i => i.name?.trim() || parseFloat(i.amount) > 0);
  const received = (session.received || []).filter(r => r.person?.trim() || parseFloat(r.amount) > 0);
  const totalSpent = session.total_spent ?? items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalReceived = session.total_received ?? received.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const net = session.net_balance ?? (totalReceived - totalSpent);
  const status = session.status === 'closed' ? 'Closed' : session.status === 'draft' ? 'Draft' : session.status === 'archived' ? 'Archived' : 'Open';
  const people = [...new Set(received.map(r => r.person?.trim()).filter(Boolean))];
  const netWord = net > 0 ? 'You’re up' : net < 0 ? 'Still to recover' : 'Balanced';
  return {
    kicker: 'Expense Tracker · Billing',
    title: session.name || 'Billing',
    subtitle: [session.date ? formatDate(session.date) : null, `${items.length} item${items.length === 1 ? '' : 's'}`, people.length ? `from ${people.join(', ')}` : null].filter(Boolean).join(' · '),
    badge: { text: status, tone: status === 'Open' ? 'accent' : 'income' },
    hero: [
      { label: 'Spent for others', value: formatAmount(totalSpent), tone: 'expense' },
      { label: 'Received back', value: formatAmount(totalReceived), tone: 'income' },
      { label: netWord, value: net > 0 ? `+${formatAmount(net)}` : formatAmount(Math.abs(net)), tone: net > 0 ? 'income' : net < 0 ? 'expense' : 'text' },
    ],
    sections: [
      { title: 'Items bought', empty: 'No items yet',
        rows: items.map(i => ({ left: i.name || 'Item', right: formatAmount(parseFloat(i.amount) || 0), tone: 'expense' })),
        total: { left: 'Total spent', right: formatAmount(totalSpent), tone: 'expense' } },
      { title: 'Money received', empty: 'Nobody has paid back yet',
        rows: received.map(r => ({ left: r.person || 'Someone', right: formatAmount(parseFloat(r.amount) || 0), tone: 'income' })),
        total: { left: 'Total received', right: formatAmount(totalReceived), tone: 'income' } },
    ],
  };
}

/** PNG of the billing (see utils/shareCard). */
export function generateSessionReceiptBlob(session) {
  return renderShareCard(billingCard(session));
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
