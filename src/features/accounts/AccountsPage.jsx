// ─── Accounts: every bank, your cash, your cards ─────────────────
// The total across everything, then each account with its colour, what
// it's for (Salary, Savings, Bills …), last 4 digits, balance and this
// month's in / out. Tap one for its entries; "Move money" for transfers,
// ATM withdrawals and card bills. Before set-up the two starter accounts
// (Bank · UPI and Cash) show, and saving any account writes them for real.
import { useMemo, useState } from 'react';
import { Plus, ArrowLeftRight, Landmark, Star, Pencil, ChevronRight, X } from 'lucide-react';
import { PageHeader, HeaderAction, SummaryCard, SectionHeading, PrimaryPill } from '../../components/Page';
import { useShell } from '../../app/shellContext';
import {
  accountBalances, accountEntries, accountLabel, colorOf, defaultAccountId, legacyAccountId, cashAccountId,
  materialise, anchorFor, nextColor, ACCOUNT_KINDS, MAIN,
} from '../../utils/accounts';
import { KIND_ICON } from '../../components/accountChoice';
import { generateId } from '../../utils/storage';
import { formatAmount, localDateKey } from '../../utils/dateHelpers';
import { toKey } from '../../utils/recurring';
import { entryKind, ENTRY_KINDS } from '../../utils/entryKinds';
import AccountModal from './AccountModal';
import MoveMoneyModal from './MoveMoneyModal';
import Portal from '../../components/Portal';
import { useEscape } from '../../hooks/useEscape';
import { t as tr } from '../../i18n';

const GROUP_TITLES = { bank: 'Bank accounts', cash: 'Cash', card: 'Credit cards' };

export default function AccountsPage({ transactions = [], income = [], settings, onPatchSettings, onAddTransaction, theme }) {
  const shell = useShell();
  const dark = theme === 'monoflow';
  const todayKey = toKey(new Date());
  const b = useMemo(() => accountBalances(transactions, income, settings, todayKey), [transactions, income, settings, todayKey]);
  const [editing, setEditing] = useState(null);     // null | 'new' | account
  const [moving, setMoving] = useState(null);       // null | { from, to }
  const [open, setOpen] = useState(null);           // account id: its entries
  const [showClosed, setShowClosed] = useState(false);
  const defaultId = defaultAccountId(settings);

  /* Save an account. The first save writes the starter accounts for real. */
  function save(id, fields, balanceNow, makeDefault) {
    onPatchSettings((prev) => {
      const base = materialise(transactions, income, prev, todayKey);
      const accId = id ?? generateId();
      let list = id ? base.map((a) => (a.id === id ? { ...a, ...fields } : a)) : [...base, { id: accId, ...fields }];
      if (balanceNow != null) {
        const anchor = anchorFor(accId, balanceNow, transactions, income, { ...prev, accounts: list }, todayKey);
        list = list.map((a) => (a.id === accId ? { ...a, ...anchor } : a));
      }
      return {
        accounts: list,
        accountsLegacy: prev.accountsLegacy ?? legacyAccountId(prev),
        ...(makeDefault ? { defaultAccount: accId } : prev.defaultAccount === accId ? { defaultAccount: null } : {}),
      };
    });
  }

  /* Remove: delete an unused account, otherwise close it (kept for history). */
  function remove(acc) {
    onPatchSettings((prev) => {
      const base = materialise(transactions, income, prev, todayKey);
      const list = acc.days === 0 && acc.id !== legacyAccountId(prev)
        ? base.filter((a) => a.id !== acc.id)
        : base.map((a) => (a.id === acc.id ? { ...a, archived: true } : a));
      return { accounts: list, accountsLegacy: prev.accountsLegacy ?? legacyAccountId(prev), ...(prev.defaultAccount === acc.id ? { defaultAccount: null } : {}) };
    });
  }
  const reopen = (acc) => onPatchSettings((prev) => ({ accounts: materialise(transactions, income, prev, todayKey).map((a) => (a.id === acc.id ? { ...a, archived: false } : a)) }));

  const live = b.accounts.filter((a) => !a.archived);
  const closed = b.accounts.filter((a) => a.archived);
  const groups = ['bank', 'cash', 'card'].map((k) => ({ key: k, list: live.filter((a) => a.kind === k) })).filter((g) => g.list.length);
  const detail = b.accounts.find((a) => a.id === open);
  const figures = [
    { label: 'Banks', value: formatAmount(b.banks) },
    { label: 'Cash', value: formatAmount(b.cash) },
    ...(b.accounts.some((a) => a.kind === 'card') ? [{ label: 'Cards due', value: formatAmount(b.cardsDue), color: b.cardsDue > 0 ? 'var(--expense)' : undefined }] : []),
  ];

  return (
    <div className="tab-root accounts-page">
      <PageHeader title={tr('Accounts')} subtitle={tr('Banks, cash and cards — what’s in each')}
        actions={<>
          <HeaderAction id="accounts-move" Icon={ArrowLeftRight} label={tr('Move money')} onClick={() => setMoving({})} />
          <HeaderAction id="accounts-add" Icon={Plus} label={tr('Add account')} onClick={() => setEditing('new')} />
        </>} />

      <div className="tab-body">
        <SummaryCard id="accounts-summary" label={tr('All accounts')} value={b.total} figures={figures}>
          <div className="acct-bar" aria-hidden>
            {live.filter((a) => a.balance > 0).map((a) => (
              <span key={a.id} style={{ flex: a.balance, background: colorOf(a, dark) }} />
            ))}
          </div>
        </SummaryCard>

        {!b.setUp && (
          <div id="accounts-starter" className="card" style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)' }}>{tr('Have more than one bank?')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {tr('Everything so far is split into “Bank · UPI” and “Cash”, from your balance today. Rename Bank · UPI to your bank, set its real balance, and add the others — HDFC for salary, SBI for savings, a credit card…')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PrimaryPill id="accounts-setup" Icon={Pencil} onClick={() => setEditing(b.accounts.find((a) => a.id === MAIN))}>{tr('Set up Bank · UPI')}</PrimaryPill>
              <button type="button" onClick={() => setEditing('new')} className="add-paid-opt" style={{ padding: '10px 14px' }}><Plus size={14} /> {tr('Add another')}</button>
            </div>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key}>
            <SectionHeading title={tr(GROUP_TITLES[g.key])} hint={g.list.length > 1 ? formatAmount(g.key === 'card' ? -g.list.reduce((s, a) => s + a.balance, 0) : g.list.reduce((s, a) => s + a.balance, 0)) + (g.key === 'card' ? ` ${tr('due')}` : '') : undefined} />
            <div className="card acct-list">
              {g.list.map((a) => <AccountRow key={a.id} a={a} dark={dark} isDefault={a.id === defaultId} onOpen={() => setOpen(a.id)} />)}
            </div>
          </div>
        ))}

        {closed.length > 0 && (
          <>
            <SectionHeading title={tr('Closed')} action={<button type="button" className="link-btn" onClick={() => setShowClosed((v) => !v)} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{showClosed ? tr('Hide') : `${tr('Show')} ${closed.length}`}</button>} />
            {showClosed && <div className="card acct-list">{closed.map((a) => <AccountRow key={a.id} a={a} dark={dark} onOpen={() => setOpen(a.id)} />)}</div>}
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55, margin: '14px 6px 0' }}>
          {tr('Every entry picks an account — Paid from / Received in. Moving money between your accounts (an ATM withdrawal, SBI → HDFC, paying the card bill) isn’t spending or income, so budgets and stats don’t count it. Entries from before you set up accounts stay on')} <strong>{accountLabel(b.accounts.find((a) => a.id === legacyAccountId(settings)))}</strong>{tr(' — change any of them by editing it.')}
        </p>
      </div>

      {detail && (
        <AccountSheet a={detail} dark={dark} isDefault={detail.id === defaultId}
          entries={accountEntries(detail.id, transactions, income, settings)}
          onClose={() => setOpen(null)}
          onEdit={() => { setEditing(detail); setOpen(null); }}
          onMove={(dir) => setMoving(dir === 'in' ? { to: detail.id } : { from: detail.id })}
          onReopen={() => reopen(detail)} />
      )}
      {editing && (
        <AccountModal
          account={editing === 'new' ? null : editing} dark={dark}
          isDefault={editing !== 'new' && editing.id === defaultId}
          color={nextColor(b.accounts)}
          canRemove={editing !== 'new' && !(editing.id === cashAccountId(settings) && editing.kind === 'cash' && live.filter((a) => a.kind === 'cash').length === 1) && live.length > 1}
          removeLabel={editing !== 'new' && editing.days === 0 && editing.id !== legacyAccountId(settings) ? 'delete' : 'close'}
          onSave={(fields, bal, def) => save(editing === 'new' ? null : editing.id, fields, bal, def)}
          onRemove={() => { remove(editing); setOpen(null); }}
          onClose={() => setEditing(null)} />
      )}
      {moving && (
        <MoveMoneyModal settings={settings} balances={b} from={moving.from} to={moving.to}
          onAdd={(entry, toast) => { onAddTransaction(entry); shell?.toast?.({ text: toast, sign: 'check' }); }}
          onClose={() => setMoving(null)} />
      )}
    </div>
  );
}

function AccountRow({ a, dark, isDefault, onOpen }) {
  const Icon = KIND_ICON[a.kind] ?? Landmark;
  const card = a.kind === 'card';
  const due = card ? -a.balance : null;
  // Only what the name doesn't already say
  const name = accountLabel(a);
  const sub = [a.bank && !name.toLowerCase().includes(a.bank.toLowerCase()) ? a.bank : '', a.last4 ? `••${a.last4}` : ''].filter(Boolean).join(' · ');
  return (
    <button type="button" id={`acct-row-${a.id}`} className="acct-row" onClick={onOpen}>
      <span className="acct-band" style={{ background: colorOf(a, dark) }} aria-hidden />
      <span className="acct-icon" style={{ color: colorOf(a, dark) }}><Icon size={17} /></span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span className="acct-name">
          {name}
          {isDefault && <Star size={11} aria-label={tr('Default')} style={{ marginLeft: 5, color: 'var(--text-muted)', verticalAlign: -1 }} />}
        </span>
        <span className="acct-sub">
          {a.tag && <span className="acct-tag">{tr(a.tag)}</span>}
          {sub}
        </span>
      </span>
      <span style={{ textAlign: 'right', flexShrink: 0 }}>
        <span className="acct-bal" style={card && due > 0 ? { color: 'var(--expense)' } : a.balance < 0 ? { color: 'var(--expense)' } : undefined}>
          {formatAmount(card ? Math.max(0, due) : a.balance)}
        </span>
        {card && <span className="acct-sub" style={{ display: 'block' }}>{due > 0 ? tr('due') : tr('clear')}{a.limit ? ` · ${formatAmount(Math.max(0, a.limit - Math.max(0, due)))} ${tr('left')}` : ''}</span>}
      </span>
      <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
}

/* One account: its balance, entries, edit / move */
function AccountSheet({ a, dark, isDefault, entries, onClose, onEdit, onMove, onReopen }) {
  useEscape(onClose);
  const [limit, setLimit] = useState(40);
  const card = a.kind === 'card';
  return (
    <Portal>
      <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div role="dialog" aria-label={accountLabel(a)} id="acct-sheet" className="add-sheet"
          style={{ width: '100%', maxWidth: 560, maxHeight: '88dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '26px 26px 0 0', padding: '16px 16px calc(18px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="acct-dot" style={{ width: 12, height: 12, background: colorOf(a, dark) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{accountLabel(a)}{isDefault && <Star size={12} style={{ marginLeft: 6, color: 'var(--text-muted)' }} />}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[a.tag && tr(a.tag), a.bank && !accountLabel(a).toLowerCase().includes(a.bank.toLowerCase()) && a.bank, a.last4 && `••${a.last4}`, tr(ACCOUNT_KINDS[a.kind]?.label ?? '')].filter(Boolean).join(' · ')}</div>
            </div>
            <button onClick={onClose} aria-label={tr('Close')} style={{ width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
          </div>

          <div style={{ margin: '14px 2px 4px' }}>
            <div className="tl-title">{card ? tr('Due now') : tr('Balance now')}</div>
            <div id="acct-sheet-balance" style={{ fontSize: 30, fontWeight: 800, color: (card ? -a.balance > 0 : a.balance < 0) ? 'var(--expense)' : 'var(--text)', letterSpacing: '-0.02em' }}>{formatAmount(card ? Math.max(0, -a.balance) : a.balance)}</div>
            {(a.monthIn > 0 || a.monthOut > 0) && <div id="acct-sheet-month" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0' }}>{tr('This month')}: <strong style={{ color: 'var(--income)' }}>+{formatAmount(a.monthIn)}</strong> · <strong>−{formatAmount(a.monthOut)}</strong></div>}
            {a.openingDate && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tr('Balance set on')} {new Date(`${a.openingDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {tr('entries since then move it')}</div>}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            <button type="button" id="acct-sheet-edit" className="add-paid-opt" onClick={onEdit}><Pencil size={12} /> {tr('Edit · set balance')}</button>
            {!a.archived && <button type="button" id="acct-sheet-out" className="add-paid-opt" onClick={() => onMove('out')}><ArrowLeftRight size={12} /> {card ? tr('Pay from here') : tr('Move from here')}</button>}
            {!a.archived && <button type="button" id="acct-sheet-in" className="add-paid-opt" onClick={() => onMove('in')}>{card ? tr('Pay the bill') : tr('Move here')}</button>}
            {a.archived && <button type="button" className="add-paid-opt" onClick={onReopen}>{tr('Reopen')}</button>}
          </div>

          <div className="section-label" style={{ margin: '6px 2px 8px' }}>{tr('Entries')}</div>
          {entries.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '6px 2px' }}>{tr('Nothing on this account yet. Pick it under “Paid from” or “Received in” when you add an entry.')}</div>
          ) : (
            <div className="acct-entries">
              {entries.slice(0, limit).map(({ entry, source, p }) => {
                const kind = entryKind(entry, source);
                return (
                  <div key={`${source}-${entry.id}`} className="acct-entry">
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(`${localDateKey(entry.date)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {tr(kind === 'withdrawal' ? 'Moved' : ENTRY_KINDS[kind]?.label ?? '')}</span>
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: p > 0 ? 'var(--income)' : 'var(--text)' }}>{p > 0 ? '+' : '−'}{formatAmount(Math.abs(p))}</span>
                  </div>
                );
              })}
              {entries.length > limit && <button type="button" className="add-paid-opt" style={{ justifySelf: 'center', marginTop: 8 }} onClick={() => setLimit((n) => n + 60)}>{tr('Show more')}</button>}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
