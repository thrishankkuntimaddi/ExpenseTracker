// ─── Admin sees (owner account only) ─────────────────────────────
// Who uses the app, from user_activity — never what they spend. Four tabs:
// Active (the default), Inactive (quiet 25+ days — these can be closed),
// Closed (sign-in off, data kept 90 days, restorable) and All accounts.
// Closing / restoring is only asked for here (account_admin/{uid}); the
// notifier carries it out with server rights and reports back.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Lock, Mail, UserX, RotateCcw, Trash2, X, ExternalLink } from 'lucide-react';
import { listActivity, listAccountAdmin, askAccount } from '../../services/activity';
import { TABS, SORTS, STATUS, INACTIVE_DAYS, KEEP_DAYS, RUN_NOW_URL, statusOf, viewUsers, summarise, agoLabel, adminStateOf, daysQuiet } from '../../utils/adminUsers';
import { fieldStyle } from '../../components/formTokens';

const muted = { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 };
const btn = (tone = 'text-secondary', filled = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
  border: filled ? 'none' : '1px solid var(--border)', background: filled ? `var(--${tone})` : 'transparent', color: filled ? '#fff' : `var(--${tone})`,
});

export default function AdminCard({ users: given, admin: givenAdmin, me }) {
  const [users, setUsers] = useState(given ?? null);
  const [admin, setAdmin] = useState(givenAdmin ?? {});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!given);
  const [tab, setTab] = useState('active');
  const [sort, setSort] = useState('opened');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [acting, setActing] = useState(null);   // { uid, kind: 'close' | 'purge' }

  const fetchList = useCallback(() => Promise.all([listActivity(), listAccountAdmin().catch(() => ({}))]).then(
    ([list, adm]) => { setUsers(list); setAdmin(adm); setNow(Date.now()); setError(null); setLoading(false); },
    (e) => {
      setError(e?.code === 'permission-denied' ? 'This account can’t read the list (check the owner email in the rules).' : 'Couldn’t load the list — check your connection.');
      setLoading(false);
    },
  ), []);
  const load = () => { setLoading(true); fetchList(); };
  useEffect(() => { if (!given) fetchList(); }, [given, fetchList]);

  const sum = useMemo(() => summarise(users ?? [], now, admin), [users, now, admin]);
  const list = useMemo(() => viewUsers(users ?? [], { tab, search, sort, admin }, now), [users, tab, search, sort, admin, now]);
  const current = TABS.find((t) => t.key === tab);

  async function ask(uid, state, note) {
    try {
      const rec = await askAccount(uid, state, note);
      setAdmin((a) => ({ ...a, [uid]: { ...a[uid], ...rec, error: null } }));
      setActing(null);
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'The rules refused that request.' : 'Couldn’t send the request — check your connection.');
    }
  }
  const pending = Object.values(admin).some((r) => ['delete_requested', 'restore_requested', 'purge_requested'].includes(r?.state));

  return (
    <div id="admin-sees" style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...muted }}>
        <Lock size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>When people use the app — never what they spend.{users ? ` ${sum.total} accounts · ${sum.today} today · ${sum.week} this week · ${sum.newWeek} new · ${sum.neverUsed} never added anything.` : ''}</span>
        <button id="admin-refresh" aria-label="Refresh" onClick={load} disabled={loading} style={{ width: 32, height: 32, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <RefreshCw size={14} className={loading ? 'spin' : undefined} />
        </button>
      </div>

      {error && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--expense)' }}>{error}</div>}
      {!users && loading && <div style={{ marginTop: 12, ...muted }}>Loading…</div>}

      {users && (
        <>
          <div role="tablist" aria-label="Accounts" className="admin-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button key={t.key} id={`admin-tab-${t.key}`} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                  style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', minWidth: 0, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'transparent' }}>
                  <div style={{ fontSize: 11, fontWeight: 650, color: on ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: on ? 'var(--accent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{sum.counts[t.key]}</div>
                </button>
              );
            })}
          </div>
          {current?.hint && <div style={{ ...muted, marginTop: 6 }}>{current.hint}</div>}
          {pending && (
            <div id="admin-pending" style={{ marginTop: 8, padding: '8px 10px', background: 'var(--surface2)', ...muted, color: 'var(--text-secondary)' }}>
              Requests run with the next server sync (every few hours).{' '}
              <a href={RUN_NOW_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>Run it now <ExternalLink size={11} style={{ verticalAlign: '-1px' }} /></a> → Run workflow, then refresh here.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <span style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input id="admin-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" style={{ ...fieldStyle, paddingLeft: 30 }} />
            </span>
            <select id="admin-sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...fieldStyle, width: 'auto' }}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div id="admin-list" style={{ marginTop: 10, border: '1px solid var(--border)' }}>
            {list.length === 0 && <div style={{ padding: 14, ...muted }}>{search ? 'Nobody matches.' : tab === 'deleted' ? 'No closed accounts.' : 'Nobody here.'}</div>}
            {list.map((u, i) => (
              <UserRow key={u.uid} u={u} now={now} first={i === 0} rec={admin[u.uid]} isMe={me && me === u.uid}
                acting={acting?.uid === u.uid ? acting.kind : null} onAct={(kind) => setActing(kind ? { uid: u.uid, kind } : null)} onAsk={ask} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UserRow({ u, now, first, rec, isMe, acting, onAct, onAsk }) {
  const st = statusOf(u, now);
  const a = adminStateOf(rec);
  const label = u.name || (u.email ?? '').split('@')[0] || 'Unnamed';
  const untracked = u.opens == null && u.entries == null;
  const quiet = daysQuiet(u, now);
  const canClose = !isMe && a !== 'closed' && quiet >= INACTIVE_DAYS && !['closing', 'restoring', 'purging'].includes(a);
  return (
    <div className="admin-user" style={{ padding: '10px 12px', borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
          {label.slice(0, 1).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            <span title={STATUS[st].label} style={{ width: 7, height: 7, borderRadius: 4, background: `var(--${STATUS[st].tone})`, flexShrink: 0 }} />
            <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 650, color: 'var(--text-secondary)', flexShrink: 0 }}>{agoLabel(u.lastOpenedAt, now)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'all' }}>{u.email || '—'}</div>
          <div style={{ ...muted, fontSize: 11, marginTop: 2 }}>
            {untracked
              ? 'Signed up, never opened an up-to-date app'
              : `${(Number(u.entries) || 0).toLocaleString('en-IN')} entries · last entry ${agoLabel(u.lastEntryAt, now)} · ${u.platform ?? 'web'}${u.version ? ` ${u.version}` : ''}`}
            {u.createdAt ? ` · joined ${agoLabel(u.createdAt, now)}` : ''}
          </div>
          <StateLine a={a} rec={rec} now={now} />
          {!acting && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {canClose && <a id={`admin-mail-${u.uid}`} href={mailto(u, quiet)} style={{ ...btn(), textDecoration: 'none' }}><Mail size={12} /> Mail them</a>}
              {canClose && <button type="button" id={`admin-close-${u.uid}`} onClick={() => onAct('close')} style={btn('expense')}><UserX size={12} /> Close account</button>}
              {a === 'closing' && <button type="button" onClick={() => onAsk(u.uid, 'cancelled')} style={btn()}><X size={12} /> Cancel</button>}
              {a === 'closed' && <button type="button" id={`admin-restore-${u.uid}`} onClick={() => onAsk(u.uid, 'restore_requested')} style={btn('income', true)}><RotateCcw size={12} /> Restore</button>}
              {a === 'closed' && <button type="button" id={`admin-purge-${u.uid}`} onClick={() => onAct('purge')} style={btn('expense')}><Trash2 size={12} /> Delete forever</button>}
            </div>
          )}
          {acting && <Confirm u={u} kind={acting} quiet={quiet} onCancel={() => onAct(null)} onConfirm={(note) => onAsk(u.uid, acting === 'close' ? 'delete_requested' : 'purge_requested', note)} />}
        </div>
      </div>
    </div>
  );
}

function StateLine({ a, rec, now }) {
  const line = {
    closing: ['lent', 'Closing — waiting for the server sync'],
    restoring: ['lent', 'Restoring — waiting for the server sync'],
    purging: ['lent', 'Deleting forever — waiting for the server sync'],
    closed: ['expense', `Closed ${agoLabel(rec?.deletedAt, now)} · sign-in off · data kept until ${rec?.purgeAfter ? new Date(rec.purgeAfter).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `${KEEP_DAYS} days`}`],
    refused: ['expense', `Not closed: ${rec?.error ?? 'the server refused'}`],
  }[a];
  const err = a !== 'refused' && rec?.error;
  if (!line && !err && !rec?.restoredAt) return null;
  return (
    <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 650, color: `var(--${line?.[0] ?? (err ? 'expense' : 'income')})` }}>
      {line ? line[1] : err ? `Last step failed: ${rec.error}` : `Restored ${agoLabel(rec.restoredAt, now)}`}
    </div>
  );
}

/* Typing their email is the confirmation — and a reminder to have told them first */
function Confirm({ u, kind, quiet, onCancel, onConfirm }) {
  const [told, setTold] = useState(false);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const close = kind === 'close';
  const want = String(u.email || u.uid).toLowerCase();
  const ok = (!close || told) && typed.trim().toLowerCase() === want;
  return (
    <div id="admin-confirm" style={{ marginTop: 8, padding: 12, border: '1.5px solid var(--expense-border)', background: 'var(--expense-bg)', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{close ? `Close ${u.name || u.email}’s account?` : `Delete ${u.name || u.email} forever?`}</div>
      <div style={{ ...muted, color: 'var(--text-secondary)' }}>
        {close
          ? `Not opened for ${quiet} days. Sign-in is switched off and their data is moved aside and kept ${KEEP_DAYS} days — Restore brings everything back. After ${KEEP_DAYS} days it is deleted for good.`
          : 'The kept data and the account are removed for good. This can’t be undone.'}
      </div>
      {close && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={told} onChange={(e) => setTold(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--expense)' }} />
          <span>I called or mailed them and they’re fine with it <a href={mailto(u, quiet)} style={{ color: 'var(--accent)', fontWeight: 700 }}>(mail them)</a></span>
        </label>
      )}
      {close && <input id="admin-confirm-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Note for yourself (optional) — e.g. “said OK on the phone, 13 Nov”" style={{ ...fieldStyle, fontSize: 12.5 }} />}
      <input id="admin-confirm-email" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${want} to confirm`} autoComplete="off" style={{ ...fieldStyle, fontSize: 12.5 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" id="admin-confirm-go" disabled={!ok} onClick={() => onConfirm(note.trim())} style={{ ...btn('expense', true), opacity: ok ? 1 : 0.5, cursor: ok ? 'pointer' : 'not-allowed' }}>
          {close ? <><UserX size={12} /> Close account</> : <><Trash2 size={12} /> Delete forever</>}
        </button>
        <button type="button" onClick={onCancel} style={btn()}>Cancel</button>
      </div>
    </div>
  );
}

function mailto(u, quiet) {
  const name = (u.name || '').split(' ')[0] || 'there';
  const subject = 'Your Expense Tracker account';
  const body = `Hi ${name},\n\nYou signed up for Expense Tracker but haven’t opened it for ${quiet} days. I’m tidying up unused accounts — is it OK if I close yours?\n\nIf you’d like to keep it, just open the app or reply to this mail. If I close it, your data is kept for ${KEEP_DAYS} days and I can bring it back if you change your mind.\n\nThanks,\nThrishank`;
  return `mailto:${encodeURIComponent(u.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
