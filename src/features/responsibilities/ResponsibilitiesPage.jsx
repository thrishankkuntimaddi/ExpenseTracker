// ─── Responsibilities ────────────────────────────────────────────
// What you've taken on to clear — a parent's loan, a promise — in the order
// you want to clear it. Pay from your salary or from savings (an FD broken),
// any amount, monthly or by a date. Never listed in Debts: nobody lent it to
// you. Goals (Savings) are the other half: the future you're saving for.
import BigAmount from '../../components/BigAmount';
import { useMemo, useState } from 'react';
import { Plus, HeartHandshake, ArrowUp, ArrowDown, Pencil, ChevronDown, Check, Trash2, Flag, ChevronRight, RotateCcw, AlertTriangle, PiggyBank, Wallet, Bell } from 'lucide-react';
import { PageHeader, HeaderAction, SectionHeading, EmptyState, PrimaryPill } from '../../components/Page';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { fieldStyle } from '../../components/formTokens';
import { useShell } from '../../app/shellContext';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { toKey } from '../../utils/recurring';
import { ordinal } from '../../utils/report';
import { RESP_PLANS, isRespOpen, sortResponsibilities, renumber, respProgress, respSummary } from '../../utils/responsibilities';
import { SAVINGS_CHOICES } from '../../utils/typeConfig';

import { t as tr } from '../../i18n';
const TONE = 'given';
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const decimal = (set) => (e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) set(v); };

export default function ResponsibilitiesPage({ transactions = [], settings, onPatchSettings, onAddTransaction, onDeleteTransaction }) {
  const shell = useShell();
  const todayKey = toKey(new Date());
  const list = useMemo(() => sortResponsibilities(settings?.responsibilities ?? []), [settings?.responsibilities]);
  const summary = useMemo(() => respSummary(list, transactions, todayKey), [list, transactions, todayKey]);
  const open = list.filter(isRespOpen);
  const done = list.filter((r) => !isRespOpen(r));
  const [edit, setEdit] = useState(null);      // null | {} (new) | resp
  const [pay, setPay] = useState(null);        // resp being paid
  const [showDone, setShowDone] = useState(false);
  const goals = (settings?.goals ?? []).filter((g) => !g.status || g.status === 'active');

  const write = (next) => onPatchSettings?.({ responsibilities: renumber(sortResponsibilities(next)) });
  function save(r) {
    const all = settings?.responsibilities ?? [];
    if (r.id) write(all.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
    else write([...all, { ...r, id: generateId(), createdAt: new Date().toISOString(), status: 'active', priority: open.length + 1 }]);
  }
  const update = (r) => write((settings?.responsibilities ?? []).map((x) => (x.id === r.id ? r : x)));
  const remove = (id) => write((settings?.responsibilities ?? []).filter((x) => x.id !== id));
  function move(r, dir) {
    const order = [...open];
    const i = order.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const prio = Object.fromEntries(order.map((x, k) => [x.id, k + 1]));
    write((settings?.responsibilities ?? []).map((x) => (prio[x.id] ? { ...x, priority: prio[x.id] } : x)));
  }
  function addPayment(resp, { amount, dateInput, from, source, note }) {
    const iso = dateInputToISO(dateInput || todayInputValue());
    const entry = {
      id: generateId(), type: 'expense', category: 'responsibility', responsibilityId: resp.id,
      name: resp.owedTo ? `${resp.title} → ${resp.owedTo}` : resp.title,
      amount: Number(amount), date: iso, month: isoToMonth(iso),
      ...(from === 'savings' ? { paidFrom: 'savings', ...(source ? { savingsSource: source } : {}) } : {}),
      ...(note?.trim() ? { note: note.trim() } : {}),
    };
    onAddTransaction?.(entry);
    const left = respProgress(resp, [...transactions, entry], todayKey).remaining;
    if (left <= 0) update({ ...resp, status: 'cleared', endedOn: todayKey });
    shell?.toast?.({ text: left <= 0 ? `${resp.title} is cleared — well done` : `Paid ${formatAmount(entry.amount)} · ${formatAmount(left)} left`, sign: 'check' });
  }

  return (
    <div className="tab-root resp-page">
      <PageHeader title={tr("Responsibilities")} subtitle={tr("Clearing the past — family loans, promises — in your order")}
        actions={<HeaderAction id="resp-add" Icon={Plus} label={tr("Add")} onClick={() => setEdit({})} />} />

      <div className="tab-body">
        {!list.length ? (
          <EmptyState Icon={HeartHandshake} tone={TONE} title={tr("Nothing to clear yet")}
            text={tr("A parent’s loan, money you promised someone — not borrowed by you, but yours to clear. Add each one with who gets paid and how much, put them in order, and pay from your salary or savings when you can.")}
            action={<PrimaryPill id="resp-empty-add" Icon={Plus} tone={TONE} onClick={() => setEdit({})}>{tr("Add a responsibility")}</PrimaryPill>} />
        ) : (
          <>
            <div className="card resp-summary" style={{ padding: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{tr("Left to clear")}</span>
              <div id="resp-left" style={{ margin: '8px 0 0' }}><BigAmount value={summary.remaining} size={40} color={`var(--${TONE})`} /></div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: `${summary.total > 0 ? Math.min(100, (summary.paid / summary.total) * 100) : 0}%`, height: '100%', background: `var(--${TONE})`, borderRadius: 99 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <Figure label={tr("Cleared so far")} value={formatAmount(summary.paid)} />
                <Figure label={tr("Paid this month")} value={formatAmount(summary.paidThisMonth)} />
                <Figure label={tr("Due this month")} value={formatAmount(summary.dueThisMonth)} color={summary.dueThisMonth > 0 ? 'var(--expense)' : undefined} />
              </div>
              {summary.next && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                  {tr("First up:")} <strong>{summary.next.resp.title}</strong> — {formatAmount(summary.next.remaining)} {tr("left")}{summary.next.resp.owedTo ? ` to ${summary.next.resp.owedTo}` : ''}.
                </div>
              )}
            </div>

            <SectionHeading id="resp-list" title={`To clear · ${open.length}`} hint={open.length > 1 ? 'top = clear first' : undefined} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {open.map((r, i) => (
                <RespItem key={r.id} resp={r} index={i} count={open.length} transactions={transactions} todayKey={todayKey}
                  onPay={() => setPay(r)} onEdit={() => setEdit(r)} onMove={(d) => move(r, d)}
                  onClear={() => update({ ...r, status: 'cleared', endedOn: todayKey })} onDeletePayment={onDeleteTransaction} />
              ))}
              {!open.length && <div className="card" style={{ padding: 14, fontSize: 13, color: 'var(--text-secondary)' }}>{tr("Everything is cleared. 🎉")}</div>}
            </div>

            {done.length > 0 && (
              <>
                <button id="resp-done-toggle" onClick={() => setShowDone((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '18px 4px 8px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span className="section-label" style={{ margin: 0 }}>{tr("Cleared ·")} {done.length}</span>
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {showDone && (
                  <div className="card">
                    {done.map((r, i) => {
                      const p = respProgress(r, transactions, todayKey);
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                              {r.status === 'cleared' ? tr("Cleared") : tr("Closed")}{r.endedOn ? ` · ${fmtDate(r.endedOn)}` : ''} · {formatAmount(p.paid)} {tr("of")} {formatAmount(p.total)}
                            </div>
                          </div>
                          <button aria-label={`Reopen ${r.title}`} title={tr("Reopen")} onClick={() => update({ ...r, status: 'active', endedOn: undefined, priority: open.length + 1 })} style={iconBtn}><RotateCcw size={13} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {open.length > 0 && !settings?.reminders?.responsibilities?.enabled && (
          <button id="resp-remind-link" onClick={() => shell?.goTo('profile', { openGroup: 'reminders' })}
            style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px dashed var(--border)', background: 'transparent', borderRadius: 12, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
            <Bell size={14} style={{ color: `var(--${TONE})`, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{tr("Get a reminder on each one’s day — turn on")} <strong>{tr("Responsibilities")}</strong> {tr("in Reminders")}</span>
            <ChevronRight size={14} />
          </button>
        )}

        {/* The other half: the future you're planning for */}
        <button id="resp-goals-link" className="card" onClick={() => shell?.goTo('savings')}
          style={{ width: '100%', marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Flag size={16} style={{ color: 'var(--savings)' }} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tr("Planning ahead?")} {goals.length ? `${goals.length} goal${goals.length === 1 ? '' : 's'}` : tr("Set a goal")}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tr("A bike, a business, a house, gold — save towards it in Savings & goals")}</span>
          </span>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {edit && <RespModal resp={edit.id ? edit : null} onSave={save} onDelete={remove} onClose={() => setEdit(null)}
        onCloseResp={(r) => update({ ...r, status: 'closed', endedOn: todayKey })} />}
      {pay && <PayModal resp={pay} progress={respProgress(pay, transactions, todayKey)} onPay={(v) => addPayment(pay, v)} onClose={() => setPay(null)} />}
    </div>
  );
}

function RespItem({ resp: r, index, count, transactions, todayKey, onPay, onEdit, onMove, onClear, onDeletePayment }) {
  const [showPayments, setShowPayments] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const p = respProgress(r, transactions, todayKey);
  const color = p.done ? 'var(--income)' : p.overdue ? 'var(--expense)' : `var(--${TONE})`;
  const planLine = r.plan === 'monthly' && Number(r.monthly) > 0
    ? `${formatAmount(Number(r.monthly))} a month${r.remindDay ? ` · on the ${ordinal(r.remindDay)}` : ''}${p.monthsLeft ? ` · about ${p.monthsLeft} month${p.monthsLeft === 1 ? '' : 's'} to go` : ''}`
    : r.plan === 'by_date' && r.dueBy
      ? (p.overdue ? `Was due ${fmtDate(r.dueBy)}` : `Clear by ${fmtDate(r.dueBy)} · ${formatAmount(p.monthlyTarget)} a month`)
      : 'Pay when you can';

  return (
    <div className="card resp-item" id={`resp-${r.id}`} style={{ padding: '14px 16px' }}>
      {confirmDel && (
        <ConfirmDeleteModal title={tr("Delete this payment?")} message="It is removed from your expenses, and the amount is added back to what’s left."
          onConfirm={() => { onDeletePayment?.(confirmDel.id); setConfirmDel(null); }} onCancel={() => setConfirmDel(null)} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span aria-label={`Priority ${index + 1}`} style={{ width: 24, height: 24, borderRadius: 8, background: `var(--${TONE}-bg)`, color: `var(--${TONE})`, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{index + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {[r.forWhom && `for ${r.forWhom}`, r.owedTo && `pay to ${r.owedTo}`].filter(Boolean).join(' · ') || tr("Who gets paid: not set")}
          </div>
        </div>
        {count > 1 && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button aria-label={`Move ${r.title} up`} disabled={index === 0} onClick={() => onMove(-1)} style={{ ...iconBtn, opacity: index === 0 ? 0.35 : 1 }}><ArrowUp size={13} /></button>
            <button aria-label={`Move ${r.title} down`} disabled={index === count - 1} onClick={() => onMove(1)} style={{ ...iconBtn, opacity: index === count - 1 ? 0.35 : 1 }}><ArrowDown size={13} /></button>
          </div>
        )}
        <button aria-label={`Edit ${r.title}`} onClick={onEdit} style={iconBtn}><Pencil size={12} /></button>
      </div>

      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
        <div style={{ height: '100%', width: `${p.pct}%`, background: color, borderRadius: 99, transition: 'width .5s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--text)' }}>{formatAmount(p.paid)}</strong> {tr("of")} {formatAmount(p.total)} {tr("cleared")}</span>
        <span style={{ fontWeight: 700, color }}>{formatAmount(p.remaining)} {tr("left")}</span>
      </div>
      <div style={{ fontSize: 11, color: p.overdue ? 'var(--expense)' : 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {p.overdue && <AlertTriangle size={11} />}{planLine}
      </div>
      {p.dueThisMonth > 0 && (
        <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)', marginTop: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 10 }}>
          {tr("This month:")} {formatAmount(p.dueThisMonth)} {tr("still to pay")}{p.paidThisMonth ? ` (${formatAmount(p.paidThisMonth)} paid)` : ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {p.done
          ? <button id={`resp-clear-${r.id}`} onClick={onClear} style={{ ...actBtn, background: 'var(--income)', color: '#fff', border: 'none' }}><Check size={13} /> {tr("Mark cleared")}</button>
          : <button id={`resp-pay-${r.id}`} onClick={onPay} style={{ ...actBtn, background: `var(--${TONE})`, color: '#fff', border: 'none' }}><Wallet size={13} /> {tr("Pay towards it")}</button>}
        {p.payments.length > 0 && (
          <button onClick={() => setShowPayments((v) => !v)} style={actBtn}>
            {p.payments.length} {tr("payment")}{p.payments.length === 1 ? '' : 's'} <ChevronDown size={13} style={{ transform: showPayments ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}
      </div>
      {showPayments && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)' }}>
          {p.payments.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {fmtDate(t.date)}{t.paidFrom === 'savings' ? ` · from savings${t.savingsSource ? ` (${t.savingsSource})` : ''}` : ''}{t.note ? ` · ${t.note}` : ''}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatAmount(t.amount)}</span>
              <button aria-label={tr("Delete payment")} onClick={() => setConfirmDel(t)} style={{ ...iconBtn, width: 26, height: 26 }}><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RespModal({ resp, onSave, onDelete, onClose, onCloseResp }) {
  const [title, setTitle] = useState(resp?.title ?? '');
  const [forWhom, setForWhom] = useState(resp?.forWhom ?? '');
  const [owedTo, setOwedTo] = useState(resp?.owedTo ?? '');
  const [total, setTotal] = useState(resp?.total != null ? String(resp.total) : '');
  const [plan, setPlan] = useState(resp?.plan ?? 'anytime');
  const [monthly, setMonthly] = useState(resp?.monthly != null ? String(resp.monthly) : '');
  const [dueBy, setDueBy] = useState(resp?.dueBy ?? '');
  const [remindDay, setRemindDay] = useState(resp?.remindDay ?? 1);
  const [note, setNote] = useState(resp?.note ?? '');
  const [confirm, setConfirm] = useState(null);
  const t = Number(total);
  const canSave = title.trim() && t > 0 && (plan !== 'monthly' || Number(monthly) > 0) && (plan !== 'by_date' || dueBy);

  function save() {
    if (!canSave) return;
    onSave({
      ...(resp ?? {}), title: title.trim(), forWhom: forWhom.trim() || null, owedTo: owedTo.trim() || null, total: t, plan,
      monthly: plan === 'monthly' ? Number(monthly) : null, dueBy: plan === 'by_date' ? dueBy : null,
      remindDay: Number(remindDay) || 1, note: note.trim() || null,
    });
    onClose();
  }

  return (
    <>
      {confirm === 'delete' && <ConfirmDeleteModal title={tr("Delete this responsibility?")} message="Payments you made stay in your expenses — only this list entry goes." onConfirm={() => { onDelete(resp.id); onClose(); }} onCancel={() => setConfirm(null)} />}
      <ModalShell title={resp ? tr("Edit responsibility") : tr("New responsibility")} subtitle={tr("Something you’re clearing for someone — not money you borrowed.")} onClose={onClose}
        footer={<>
          {resp && <GhostButton danger onClick={() => setConfirm('delete')} style={{ flex: '0 0 auto', padding: '11px 14px' }}><Trash2 size={13} /></GhostButton>}
          {resp ? <GhostButton onClick={() => { onCloseResp(resp); onClose(); }}>{tr("Close it")}</GhostButton> : <GhostButton onClick={onClose}>{tr("Cancel")}</GhostButton>}
          <PrimaryButton onClick={save} disabled={!canSave} color={`var(--${TONE})`}><Check size={14} /> {resp ? tr("Save") : tr("Add")}</PrimaryButton>
        </>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
          <Field label={tr("What is it")}>
            <input id="resp-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("Mom’s gold loan")} style={fieldStyle} autoFocus />
          </Field>
          <Field label={tr("Total")}>
            <input id="resp-total" type="text" inputMode="decimal" value={total} onChange={decimal(setTotal)} placeholder="50000" style={{ ...fieldStyle, fontWeight: 700 }} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label={tr("For whom")}>
            <input id="resp-for" type="text" value={forWhom} onChange={(e) => setForWhom(e.target.value)} placeholder={tr("Mom, Dad, a promise…")} style={fieldStyle} />
          </Field>
          <Field label={tr("Pay to / borrowed from")}>
            <input id="resp-to" type="text" value={owedTo} onChange={(e) => setOwedTo(e.target.value)} placeholder={tr("Ramesh uncle, SBI…")} style={fieldStyle} />
          </Field>
        </div>
        <Field label={tr("How you’ll clear it")}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RESP_PLANS.map((p) => (
              <button key={p.key} type="button" id={`resp-plan-${p.key}`} onClick={() => setPlan(p.key)} title={p.hint} style={chip(plan === p.key)}>{p.label}</button>
            ))}
          </div>
        </Field>
        {plan === 'monthly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={tr("Each month")} hint={t > 0 && Number(monthly) > 0 ? `Cleared in about ${Math.ceil(t / Number(monthly))} months` : undefined}>
              <input id="resp-monthly" type="text" inputMode="decimal" value={monthly} onChange={decimal(setMonthly)} placeholder="5000" style={fieldStyle} />
            </Field>
            <RemindField value={remindDay} onChange={setRemindDay} />
          </div>
        )}
        {plan === 'by_date' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={tr("Clear it all by")}>
              <input id="resp-due" type="date" value={dueBy} min={toKey(new Date())} onChange={(e) => setDueBy(e.target.value)} style={fieldStyle} />
            </Field>
            <RemindField value={remindDay} onChange={setRemindDay} />
          </div>
        )}
        {plan === 'anytime' && <RemindField value={remindDay} onChange={setRemindDay} />}
        <Field label={tr("Note (optional)")}>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Interest, papers, who else is helping…")} style={fieldStyle} />
        </Field>
      </ModalShell>
    </>
  );
}

function RemindField({ value, onChange }) {
  return (
    <Field label={tr("Remind me on the")} hint={tr("Your salary day works well")}>
      <select id="resp-remind" value={value} onChange={(e) => onChange(Number(e.target.value))} style={fieldStyle}>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)} {tr("of the month")}</option>)}
      </select>
    </Field>
  );
}

function PayModal({ resp, progress, onPay, onClose }) {
  const suggested = progress.dueThisMonth > 0 ? progress.dueThisMonth : '';
  const [amount, setAmount] = useState(suggested ? String(suggested) : '');
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [from, setFrom] = useState('salary');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const a = Number(amount);
  const can = a > 0;
  const save = () => { if (!can) return; onPay({ amount: a, dateInput, from, source: source.trim(), note }); onClose(); };

  return (
    <ModalShell title={`Pay · ${resp.title}`} subtitle={`${formatAmount(progress.remaining)} left${resp.owedTo ? ` to ${resp.owedTo}` : ''}`} onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>{tr("Cancel")}</GhostButton>
        <PrimaryButton onClick={save} disabled={!can} color={`var(--${TONE})`}><Check size={14} /> {can ? `Pay ${formatAmount(a)}` : tr("Pay")}</PrimaryButton>
      </>}>
      <Field label={tr("Amount")} hint={progress.remaining > 0 ? `All of it: ${formatAmount(progress.remaining)}` : undefined}>
        <input id="resp-pay-amount" type="text" inputMode="decimal" value={amount} onChange={decimal(setAmount)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="0" style={{ ...fieldStyle, fontWeight: 800, fontSize: 18 }} autoFocus />
      </Field>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: -4 }}>
        {[progress.dueThisMonth, progress.remaining].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((v) => (
          <button key={v} type="button" onClick={() => setAmount(String(v))} style={chip(a === v)}>{v === progress.remaining ? tr("Clear it all") : tr("This month")} · {formatAmount(v)}</button>
        ))}
      </div>
      <Field label={tr("Paid from")}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" id="resp-from-salary" onClick={() => setFrom('salary')} style={{ ...chip(from === 'salary'), display: 'inline-flex', alignItems: 'center', gap: 5 }}><Wallet size={12} /> {tr("This month’s money")}</button>
          <button type="button" id="resp-from-savings" onClick={() => setFrom('savings')} style={{ ...chip(from === 'savings'), display: 'inline-flex', alignItems: 'center', gap: 5 }}><PiggyBank size={12} /> {tr("My savings")}</button>
        </div>
      </Field>
      {from === 'savings' && (
        <Field label={tr("Which savings")} hint={tr("It doesn’t come off this month’s balance — it comes out of what you saved.")}>
          <input id="resp-savings-source" type="text" list="resp-savings-kinds" value={source} onChange={(e) => setSource(e.target.value)} placeholder={tr("Broke an FD, sold gold…")} style={fieldStyle} />
          <datalist id="resp-savings-kinds">{SAVINGS_CHOICES.map((s) => <option key={s.key} value={s.label} />)}</datalist>
        </Field>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8 }}>
        <Field label={tr("Date")}>
          <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label={tr("Note (optional)")}>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Gave cash to uncle")} style={fieldStyle} />
        </Field>
      </div>
    </ModalShell>
  );
}

function Figure({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 750, color, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const iconBtn = { width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 9 };
const actBtn = { flex: 1, padding: '9px 6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap', borderRadius: 11 };
const chip = (active) => ({
  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  border: `1.5px solid ${active ? `var(--${TONE})` : 'var(--border)'}`, background: active ? `var(--${TONE}-bg)` : 'var(--surface2)',
  color: active ? `var(--${TONE})` : 'var(--text-secondary)',
});
