// ─── Account Aggregator data → statement lines ────────────────────
// Bank data from Setu AA arrives in the ReBIT FI format (one block per
// account, each with a list of transactions). It becomes the same "lines"
// the statement import reads — { date, desc, amount, dir, balance } — so the
// app reviews it exactly like an imported statement (duplicates unticked).
// Pure, no dependencies: the server uses it, the app's tests import it.

const pad = (n) => String(n).padStart(2, '0');

/** "2026-11-03T21:40:00+05:30" / "2026-11-03" → "2026-11-03" (the bank's own calendar day). */
export function fiDate(v) {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const maskOf = (acc) => {
  const m = String(acc?.maskedAccNumber ?? acc?.linkedAccRef ?? '').match(/(\d{3,4})\s*$/);
  return m ? `••${m[1]}` : '';
};

/** Every account's transactions, as lines. Accepts Setu's session response or a bare list of FI blocks. */
export function fiToLines(data) {
  const fips = Array.isArray(data) ? data : data?.fips ?? data?.Payload ?? [];
  const lines = [];
  for (const fip of fips) {
    for (const acc of fip?.accounts ?? fip?.data ?? []) {
      const a = acc?.data?.account ?? acc?.account ?? acc;
      const list = a?.transactions?.transaction ?? [];
      const account = maskOf(acc) || maskOf(a);
      for (const t of Array.isArray(list) ? list : [list]) {
        const amount = Math.abs(Number(t?.amount));
        const date = fiDate(t?.valueDate ?? t?.transactionTimestamp);
        const type = String(t?.type ?? '').toUpperCase();
        if (!(amount > 0) || !date || !['DEBIT', 'CREDIT'].includes(type)) continue;
        lines.push({
          date,
          desc: String(t?.narration ?? t?.reference ?? '').trim() || (type === 'CREDIT' ? 'Money in' : 'Payment'),
          amount: Math.round(amount * 100) / 100,
          dir: type === 'CREDIT' ? 'in' : 'out',
          ...(Number.isFinite(Number(t?.currentBalance)) && t?.currentBalance !== '' ? { balance: Number(t.currentBalance) } : {}),
          ...(account ? { account } : {}),
          ...(t?.txnId ? { txnId: String(t.txnId) } : {}),
        });
      }
    }
  }
  return lines.sort((x, y) => x.date.localeCompare(y.date));
}

/** A stable document id for a bank transaction (re-fetching never doubles it). */
export function inboxId(line) {
  const raw = line.txnId ? `${line.account ?? ''}_${line.txnId}` : `${line.account ?? ''}_${line.date}_${line.dir}_${line.amount}_${line.desc}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  return `${line.date}_${(h >>> 0).toString(36)}`;
}
