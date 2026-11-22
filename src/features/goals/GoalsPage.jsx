// ─── Goals: what you're working towards ──────────────────────────
// Savings is where money is put away (SIPs, funds, FDs, cash). Goals are the
// things you mean to get: a phone, gold, a bike — and everything that comes
// with it. Two kinds, one list (settings.goals):
//   • a plan to buy: items with an estimated and an actual cost, ticked off
//     as you buy them, in your order (drag #) — goal.items = [{ id, name,
//     est, actual, done, txnId }]. Bought items can go to your expenses in
//     one tap, from the account you paid with.
//   • a money goal: a target you save towards (the goals that used to live
//     under Savings, unchanged — see utils/goals.js).
// Either can take money put aside for it (a savings entry with goalId).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Flag, ShoppingBag, Pencil, Check, Trash2, ChevronDown, Receipt, PiggyBank, RotateCcw } from 'lucide-react';
import { PageHeader, HeaderAction, SummaryCard, SectionHeading, EmptyState, PrimaryPill } from '../../components/Page';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import Sheet from '../../components/Sheet';
import AccountPicker from '../../components/AccountPicker';
import { useAccountChoice, rememberAccount } from '../../components/accountChoice';
import GoalsCard from '../plan/components/GoalsCard';
import GoalModal from '../plan/GoalModal';
import { fieldStyle } from '../../components/formTokens';
import { useShell } from '../../app/shellContext';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { currencySymbol } from '../../utils/money';
import { computeGoalProgress, isGoalOpen } from '../../utils/goals';
import { planTotals, isPlan } from '../../utils/goalPlans';
import { accountFields } from '../../utils/accounts';
import { toKey } from '../../utils/recurring';
import { t as tr } from '../../i18n';

const TONE = 'savings';
const newItem = () => ({ id: generateId(), name: '', est: '', actual: '', done: false });

export default function GoalsPage({ transactions = [], settings, onPatchSettings, onAddTransaction }) {
  const shell = useShell();
  const goals = useMemo(() => settings?.goals ?? [], [settings?.goals]);
  const plans = goals.filter((g) => isPlan(g) && isGoalOpen(g));
  const money = goals.filter((g) => !isPlan(g));
  const donePlans = goals.filter((g) => isPlan(g) && !isGoalOpen(g));
  const [planModal, setPlanModal] = useState(null);    // null | 'new' | plan
  const [goalModal, setGoalModal] = useState(null);    // null | 'new' | goal
  const [logging, setLogging] = useState(null);        // a plan: bought items → expenses
  const [showDone, setShowDone] = useState(false);

  // Function patches: built from the settings as they are when written
  const writeGoals = (fn) => onPatchSettings?.((cur) => ({ goals: fn(cur?.goals ?? []) }));
  const upsert = (g) => writeGoals((all) => (all.some((x) => x.id === g.id) ? all.map((x) => (x.id === g.id ? { ...x, ...g } : x)) : [...all, g]));
  const removeGoal = (id) => writeGoals((all) => all.filter((x) => x.id !== id));

  const totals = useMemo(() => {
    const open = plans.map((p) => planTotals(p));
    return {
      left: open.reduce((s, t) => s + t.left, 0),
      spent: open.reduce((s, t) => s + t.spent, 0),
      items: open.reduce((s, t) => s + t.count - t.bought, 0),
    };
  }, [plans]);

  function logBought(plan, accountId, dateInput) {
    const iso = dateInputToISO(dateInput || todayInputValue());
    const ids = {};
    planTotals(plan).unlogged.forEach((it) => {
      const id = generateId();
      ids[it.id] = id;
      onAddTransaction?.({ id, type: 'expense', name: it.name.trim() || plan.name, amount: Number(it.actual) || Number(it.est), note: plan.name, goalId: plan.id, ...accountFields(accountId, settings), date: iso, month: isoToMonth(iso) });
    });
    rememberAccount('expense', accountId);
    writeGoals((all) => all.map((g) => (g.id === plan.id ? { ...g, items: (g.items ?? []).map((it) => (ids[it.id] ? { ...it, txnId: ids[it.id] } : it)) } : g)));
    const n = Object.keys(ids).length;
    shell?.toast?.({ text: `${n} ${n === 1 ? tr('item') : tr('items')} ${tr('added to your expenses')}`, sign: 'check' });
  }

  const empty = !goals.length;
  return (
    <div className="tab-root goals-page">
      <PageHeader title={tr('Goals')} subtitle={tr('What you’re working towards — what it takes, what it costs')}
        actions={<HeaderAction id="goals-add" Icon={Plus} label={tr('Plan something')} onClick={() => setPlanModal('new')} />} />

      <div className="tab-body">
        {empty ? (
          <EmptyState Icon={Flag} tone={TONE} title={tr('Nothing planned yet')}
            text={tr('A bike and everything that comes with it — helmet, fog lights, top box, GPS mount, dash cam. List it, put an estimate on each, tick them off as you buy them and see what it really cost. Or set a money goal and save towards it.')}
            action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <PrimaryPill id="goals-empty-plan" Icon={ShoppingBag} tone={TONE} onClick={() => setPlanModal('new')}>{tr('Plan a purchase')}</PrimaryPill>
              <button type="button" id="goals-empty-money" className="add-paid-opt" style={{ padding: '10px 14px' }} onClick={() => setGoalModal('new')}><PiggyBank size={14} /> {tr('Money goal')}</button>
            </div>} />
        ) : (
          <SummaryCard id="goals-summary" label={tr('Still to buy')} value={totals.left} color={`var(--${TONE})`}
            figures={[
              { label: tr('Items left'), value: String(totals.items) },
              { label: tr('Spent so far'), value: formatAmount(totals.spent) },
              { label: tr('Money goals'), value: String(money.filter(isGoalOpen).length) },
            ]} />
        )}

        {plans.length > 0 && <SectionHeading title={`${tr('Plans')} · ${plans.length}`} hint={tr('drag # to reorder · tick when bought')} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} transactions={transactions}
              onItems={(items) => writeGoals((all) => all.map((g) => (g.id === p.id ? { ...g, items } : g)))}
              onEdit={() => setPlanModal(p)}
              onLog={(live) => setLogging(live)}
              onSave={() => shell?.openAdd('savings', { goalId: p.id })}
              onFinish={() => upsert({ ...p, status: 'collected', endedOn: toKey(new Date()) })} />
          ))}
        </div>

        {!empty && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px' }}>
            <button type="button" id="goals-new-plan" className="add-paid-opt" style={{ padding: '9px 13px' }} onClick={() => setPlanModal('new')}><ShoppingBag size={13} /> {tr('Plan a purchase')}</button>
            <button type="button" id="goals-new-money" className="add-paid-opt" style={{ padding: '9px 13px' }} onClick={() => setGoalModal('new')}><PiggyBank size={13} /> {tr('Money goal')}</button>
          </div>
        )}

        {money.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <GoalsCard goals={money} transactions={transactions} onAdd={() => setGoalModal('new')} onEdit={(g) => setGoalModal(g)}
              onUpdate={(g) => upsert(g)} onContribute={(g) => shell?.openAdd('savings', { goalId: g.id })} />
          </div>
        )}

        {donePlans.length > 0 && (
          <>
            <button type="button" id="goals-done-toggle" onClick={() => setShowDone((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '18px 4px 8px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span className="section-label" style={{ margin: 0 }}>{tr('Got it ·')} {donePlans.length}</span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {showDone && (
              <div className="card">
                {donePlans.map((p, i) => {
                  const t = planTotals(p);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <Check size={15} style={{ color: 'var(--income)', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.bought} {tr('of')} {t.count} {tr('items')} · {formatAmount(t.spent)} {tr('spent')} · {tr('estimate')} {formatAmount(t.est)}</span>
                      </span>
                      <button type="button" className="add-paid-opt" onClick={() => upsert({ ...p, status: 'active', endedOn: null })}><RotateCcw size={12} /> {tr('Reopen')}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {planModal && (
        <PlanModal plan={planModal === 'new' ? null : planModal}
          onSave={(p) => upsert(p)}
          onDelete={(p) => { removeGoal(p.id); setPlanModal(null); }}
          onClose={() => setPlanModal(null)} />
      )}
      {goalModal && (
        <GoalModal goal={goalModal === 'new' ? null : goalModal}
          onSave={(g) => upsert(g.id ? g : { ...g, id: generateId() })}
          onDelete={(id) => removeGoal(id)} onClose={() => setGoalModal(null)} />
      )}
      {logging && (
        <LogModal plan={logging} onLog={(acc, d) => logBought(logging, acc, d)} onClose={() => setLogging(null)} />
      )}
    </div>
  );
}

/* One plan: its items as a small sheet, the totals, what to do next */
function PlanCard({ plan, transactions, onItems, onEdit, onLog, onSave, onFinish }) {
  // Edits stay local and are written a moment after the last keystroke
  const [rows, setRows] = useState(() => (plan.items ?? []).map((it) => ({ ...it, est: it.est ?? '', actual: it.actual ?? '' })));
  // Logged to expenses (txnId) on the settings side: carry it into the rows, so a later edit keeps it
  const logged = (plan.items ?? []).filter((it) => it.txnId).map((it) => `${it.id}:${it.txnId}`).join(',');
  const [seenLogged, setSeenLogged] = useState(logged);
  if (logged !== seenLogged) {
    setSeenLogged(logged);
    const ids = Object.fromEntries((plan.items ?? []).filter((it) => it.txnId).map((it) => [it.id, it.txnId]));
    setRows((rs) => rs.map((r) => (ids[r.id] && ids[r.id] !== r.txnId ? { ...r, txnId: ids[r.id] } : r)));
  }
  const pending = useRef(null);
  const latest = useRef(onItems);
  useEffect(() => { latest.current = onItems; }, [onItems]);
  const flush = () => { if (pending.current) { clearTimeout(pending.current.t); latest.current(pending.current.items); pending.current = null; } };
  useEffect(() => flush, []);
  function change(next) {
    setRows(next);
    const items = next.filter((r) => r.name?.trim() || r.est !== '' || r.actual !== '').map((r) => ({
      id: r.id, name: (r.name ?? '').trim(), est: r.est === '' ? null : Number(r.est), actual: r.actual === '' ? null : Number(r.actual), done: !!r.done, ...(r.txnId ? { txnId: r.txnId } : {}),
    }));
    if (pending.current) clearTimeout(pending.current.t);
    pending.current = { items, t: setTimeout(flush, 700) };
  }
  const live = { ...plan, items: rows.map((r) => ({ ...r, est: r.est === '' ? null : Number(r.est), actual: r.actual === '' ? null : Number(r.actual) })) };
  const t = planTotals(live);
  const saved = computeGoalProgress({ ...plan, target: t.est || 1, linked: true }, transactions).saved;
  const pct = t.est > 0 ? Math.min(100, Math.round((t.boughtEst / t.est) * 100)) : 0;
  const over = Math.round((t.spent - t.boughtEst) * 100) / 100;

  return (
    <div id={`plan-${plan.id}`} className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: `var(--${TONE}-bg)`, color: `var(--${TONE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ShoppingBag size={17} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{plan.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
            {t.bought} {tr('of')} {t.count} {tr('bought')}{plan.deadline ? ` · ${tr('by')} ${new Date(`${plan.deadline}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}{plan.note ? ` · ${plan.note}` : ''}
          </div>
        </div>
        <button type="button" aria-label={tr('Edit plan')} onClick={onEdit} style={{ width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9 }}><Pencil size={13} /></button>
      </div>

      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden', margin: '12px 0 8px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `var(--${TONE})`, borderRadius: 99 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
        <Fig label={tr('Estimate')} value={formatAmount(t.est)} />
        <Fig label={tr('Spent')} value={formatAmount(t.spent)} sub={t.bought && over ? `${over > 0 ? '+' : '−'}${formatAmount(Math.abs(over))} ${over > 0 ? tr('over') : tr('under')}` : null} subTone={over > 0 ? 'expense' : 'income'} />
        <Fig label={tr('Left to buy')} value={formatAmount(t.left)} sub={saved > 0 ? `${formatAmount(saved)} ${tr('put aside')}` : null} subTone={TONE} />
      </div>

      <Sheet id={`plan-items-${plan.id}`} tone={TONE} reorderable rows={rows} onChange={change} makeRow={newItem} rowLabel={(r) => r.name}
        rowClass={(r) => (r.done ? 'sheet-done' : '')}
        columns={[
          { key: 'done', label: '✓', type: 'check', width: '38px', onToggle: (r) => ({ done: !r.done, ...(!r.done && (r.actual === '' || r.actual == null) && r.est !== '' ? { actual: String(r.est) } : {}) }) },
          { key: 'name', label: tr('Item'), type: 'text', placeholder: tr('Helmet, fog lights…') },
          { key: 'est', label: `${tr('Estimate')} ${currencySymbol()}`, type: 'amount', width: '92px', placeholder: '0' },
          { key: 'actual', label: `${tr('Actual')} ${currencySymbol()}`, type: 'amount', width: '92px', placeholder: '—' },
        ]} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {t.unlogged.length > 0 && (
          <button type="button" id={`plan-log-${plan.id}`} className="add-paid-opt" onClick={() => { flush(); onLog(live); }} style={{ padding: '8px 12px' }}>
            <Receipt size={13} /> {tr('Add')} {t.unlogged.length} {tr('bought to expenses')} · {formatAmount(t.unloggedSum)}
          </button>
        )}
        <button type="button" className="add-paid-opt" onClick={onSave} style={{ padding: '8px 12px' }}><PiggyBank size={13} /> {tr('Put money aside')}</button>
        {t.count > 0 && t.bought === t.count && (
          <button type="button" id={`plan-finish-${plan.id}`} className="add-paid-opt" onClick={() => { flush(); onFinish(); }} style={{ padding: '8px 12px', color: 'var(--income)' }}><Check size={13} /> {tr('All done')}</button>
        )}
      </div>
    </div>
  );
}

function Fig({ label, value, sub, subTone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, fontWeight: 700, color: `var(--${subTone})` }}>{sub}</div>}
    </div>
  );
}

/* Name, by when, a note */
function PlanModal({ plan, onSave, onDelete, onClose }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [byMonth, setByMonth] = useState(plan?.deadline ? plan.deadline.slice(0, 7) : '');
  const [note, setNote] = useState(plan?.note ?? '');
  const [confirm, setConfirm] = useState(false);
  const ok = !!name.trim();
  function save() {
    if (!ok) return;
    const [y, m] = byMonth ? byMonth.split('-').map(Number) : [];
    const deadline = byMonth ? toKey(new Date(y, m, 0)) : null;
    onSave({
      ...(plan ?? { id: generateId(), startDate: toKey(new Date()), linked: true, status: 'active', items: [] }),
      name: name.trim(), deadline, note: note.trim() || null,
    });
    onClose();
  }
  return (
    <>
      <ModalShell title={plan ? tr('Edit plan') : tr('Plan a purchase')} subtitle={plan ? null : tr('Name it — then list what it takes, with an estimate for each')} onClose={onClose}
        footer={<>
          {plan && <GhostButton danger onClick={() => setConfirm(true)}><Trash2 size={13} /> {tr('Delete')}</GhostButton>}
          <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>
          <PrimaryButton id="plan-save" onClick={save} disabled={!ok} color={`var(--${TONE})`}><Check size={14} /> {plan ? tr('Save') : tr('Create')}</PrimaryButton>
        </>}>
        <Field label={tr('What is it?')}>
          <input id="plan-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder={tr('Bike, new phone, Diwali gold…')} style={fieldStyle} />
        </Field>
        <Field label={tr('By when (optional)')}>
          <input id="plan-by" type="month" value={byMonth} onChange={(e) => setByMonth(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label={tr('Note (optional)')}>
          <input id="plan-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('After the bonus · from the showroom on MG Road')} style={fieldStyle} />
        </Field>
      </ModalShell>
      {confirm && (
        <ConfirmDeleteModal title={tr('Delete this plan?')} message={tr('Its list goes. Expenses you already added from it stay in your history.')}
          onConfirm={() => { setConfirm(false); onDelete(plan); }} onCancel={() => setConfirm(false)} />
      )}
    </>
  );
}

/* Bought items → expenses, from the account they were paid with */
function LogModal({ plan, onLog, onClose }) {
  const t = planTotals(plan);
  const [acct, setAcct] = useAccountChoice('expense');
  const [dateInput, setDateInput] = useState(todayInputValue());
  return (
    <ModalShell title={`${tr('Add to expenses')} · ${plan.name}`} subtitle={`${t.unlogged.length} ${tr('items')} · ${formatAmount(t.unloggedSum)}`} onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>
        <PrimaryButton id="plan-log-go" onClick={() => { onLog(acct, dateInput); onClose(); }} color="var(--expense)"><Receipt size={14} /> {tr('Add')} {formatAmount(t.unloggedSum)}</PrimaryButton>
      </>}>
      <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        {t.unlogged.map((it) => (
          <div key={it.id} style={{ display: 'flex', fontSize: 13, color: 'var(--text)' }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name || plan.name}</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAmount(Number(it.actual) || Number(it.est))}</strong>
          </div>
        ))}
      </div>
      <AccountPicker id="plan-log-acct" label="Paid from" value={acct} onChange={setAcct} />
      <Field label={tr('Date')}>
        <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} style={fieldStyle} />
      </Field>
    </ModalShell>
  );
}
