// ─── Admin sees (owner, and trustees read-only) ──────────────────
// Five views:
//   People  — who uses the app and how (never what they spend). Tap someone
//             for their account details; actions live there, so the list
//             stays calm. The owner can close any account — a quiet one, or
//             (with a stronger confirmation) one that still opens the app.
//   Inbox   — problems, ideas and questions people send from Help, plus
//             crashes and deletions the app reports by itself.
//   Insights — which features people use, which app versions are out there,
//             whose settings look wiped, and who hit problems this week.
//   Health  — the server job: run it now, its runs (cancel a stuck one),
//             Firestore reads / writes / deletes against the free daily
//             quota, and live checks from here.
//   Control — (owner) banners on everyone's Home, maintenance, the minimum
//             app version (AdminControl.jsx, app_config/live).
//   Team    — (owner) trustees: people who may see all this, read only.
// Closing / restoring is only asked for here (account_admin/{uid}); the
// notifier carries it out with server rights and reports back.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Lock, Mail, UserX, RotateCcw, Trash2, X, ChevronDown, Users, Inbox, Activity, ShieldCheck, Check, CircleAlert, CircleCheck, Plus, BarChart2, SlidersHorizontal, Server, Database, Radio } from 'lucide-react';
import { listActivity, listAccountAdmin, askAccount } from '../../services/activity';
import { listFeedback, markFeedback, removeFeedback, FEEDBACK_KINDS } from '../../services/feedback';
import { getTeam, saveTeam, getHealth, liveChecks } from '../../services/adminTeam';
import { TABS, SORTS, STATUS, INACTIVE_DAYS, KEEP_DAYS, statusOf, viewUsers, summarise, agoLabel, adminStateOf, daysQuiet, insights } from '../../utils/adminUsers';
import { fieldStyle } from '../../components/formTokens';
import { Panel, ControlView, ServerJobRuns, RunNowButton, MonitoringHelp } from './AdminControl';
import { muted, btn, useServerJob } from './adminUi';

const VIEWS = [
  { key: 'people', label: 'People', Icon: Users },
  { key: 'inbox', label: 'Inbox', Icon: Inbox },
  { key: 'insights', label: 'Insights', Icon: BarChart2 },
  { key: 'health', label: 'Health', Icon: Activity },
  { key: 'control', label: 'Control', Icon: SlidersHorizontal, owner: true },
  { key: 'team', label: 'Team', Icon: ShieldCheck, owner: true },
];
const PROJECT = import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'expensetracker-385b0';

export default function AdminCard({ users: given, admin: givenAdmin, me, user, readOnly = false, initialView = 'people' }) {
  const [view, setView] = useState(initialView);
  const [users, setUsers] = useState(given ?? null);
  const [admin, setAdmin] = useState(givenAdmin ?? {});
  const [inbox, setInbox] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!given);
  const [now, setNow] = useState(() => Date.now());

  const fetchList = useCallback(() => Promise.all([listActivity(), listAccountAdmin().catch(() => ({})), listFeedback().catch(() => [])]).then(
    ([list, adm, fb]) => { setUsers(list); setAdmin(adm); setInbox(fb); setNow(Date.now()); setError(null); setLoading(false); },
    (e) => {
      setError(e?.code === 'permission-denied' ? 'This account can’t read the list (check the owner email in the rules, or ask the owner to add you to the team).' : 'Couldn’t load the list — check your connection.');
      setLoading(false);
    },
  ), []);
  const load = () => { setLoading(true); fetchList(); };
  useEffect(() => { if (!given) fetchList(); }, [given, fetchList]);

  const sum = useMemo(() => summarise(users ?? [], now, admin), [users, now, admin]);
  const fresh = (inbox ?? []).filter((f) => f.status === 'new').length;
  // The server job (owner): one place for the token and its runs, used by People and Health
  const job = useServerJob(!readOnly && !given);

  return (
    <div id="admin-sees" className="admin-sees" style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...muted }}>
        <Lock size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{readOnly ? 'You see this as a trustee — read only. ' : ''}When and how people use the app — never what they spend.</span>
        <button id="admin-refresh" aria-label="Refresh" onClick={load} disabled={loading} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <RefreshCw size={14} className={loading ? 'spin' : undefined} />
        </button>
      </div>

      {users && (
        <div id="admin-stats" className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 10 }}>
          {[['Accounts', sum.total], ['Today', sum.today], ['This week', sum.week], ['New · 7 d', sum.newWeek]].map(([l, v]) => (
            <div key={l} style={{ padding: '8px 10px', borderRadius: 12, background: 'var(--surface2)', minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              <div style={{ fontSize: 10.5, fontWeight: 650, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <div role="tablist" aria-label="Admin views" className="admin-views" style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {VIEWS.filter((v) => !v.owner || !readOnly).map(({ key, label, Icon }) => {
          const on = view === key;
          return (
            <button key={key} id={`admin-view-${key}`} role="tab" aria-selected={on} onClick={() => setView(key)}
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 99, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? 'var(--accent-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <Icon size={13} /> {label}
              {key === 'inbox' && fresh > 0 && <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--expense)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{fresh}</span>}
            </button>
          );
        })}
      </div>

      {error && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--expense)' }}>{error}</div>}
      {!users && loading && <div style={{ marginTop: 12, ...muted }}>Loading…</div>}

      {view === 'people' && users && <People users={users} admin={admin} setAdmin={setAdmin} now={now} me={me} readOnly={readOnly} setError={setError} job={job} onRefresh={load} />}
      {view === 'inbox' && <InboxView items={inbox} setItems={setInbox} now={now} readOnly={readOnly} />}
      {view === 'insights' && users && <InsightsView users={users} now={now} inbox={inbox} />}
      {view === 'health' && <Health user={user} readOnly={readOnly} job={job} />}
      {view === 'control' && !readOnly && <ControlView />}
      {view === 'team' && !readOnly && <Team />}
    </div>
  );
}

/* ═════ People ═════ */
function People({ users, admin, setAdmin, now, me, readOnly, setError, job, onRefresh }) {
  const [tab, setTab] = useState('active');
  const [sort, setSort] = useState('opened');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const sum = useMemo(() => summarise(users, now, admin), [users, now, admin]);
  const list = useMemo(() => viewUsers(users, { tab, search, sort, admin }, now), [users, tab, search, sort, admin, now]);
  const current = TABS.find((t) => t.key === tab);
  const pending = Object.values(admin).some((r) => ['delete_requested', 'restore_requested', 'purge_requested', 'self_delete_requested'].includes(r?.state));

  async function ask(uid, state, note, opts) {
    try {
      const rec = await askAccount(uid, state, note, opts);
      setAdmin((a) => ({ ...a, [uid]: { ...a[uid], ...rec, error: null } }));
      return true;
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'The rules refused that request.' : 'Couldn’t send the request — check your connection.');
      return false;
    }
  }

  return (
    <>
      <div role="tablist" aria-label="Accounts" className="admin-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} id={`admin-tab-${t.key}`} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              style={{ padding: '8px 10px', borderRadius: 12, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', minWidth: 0, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'transparent' }}>
              <div style={{ fontSize: 11, fontWeight: 650, color: on ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: on ? 'var(--accent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{sum.counts[t.key]}</div>
            </button>
          );
        })}
      </div>
      {current?.hint && <div style={{ ...muted, marginTop: 6 }}>{current.hint}</div>}
      {pending && (
        <div id="admin-pending" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)', ...muted, color: 'var(--text-secondary)' }}>
          <div>Requests are carried out by the server job — on its schedule, or now:</div>
          {!readOnly && job && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <RunNowButton job={job} label="Run the server job now" />
              <button type="button" onClick={onRefresh} style={btn()}><RefreshCw size={12} /> Refresh list</button>
            </div>
          )}
          {job?.runs?.[0] && <div style={{ marginTop: 4 }}>Last run: {job.runs[0].status !== 'completed' ? 'running now' : job.runs[0].conclusion} · {agoLabel(Date.parse(job.runs[0].created_at), now)}</div>}
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

      <div id="admin-list" style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {list.length === 0 && <div style={{ padding: 14, ...muted }}>{search ? 'Nobody matches.' : tab === 'deleted' ? 'No closed accounts.' : 'Nobody here.'}</div>}
        {list.map((u, i) => (
          <UserRow key={u.uid} u={u} now={now} first={i === 0} rec={admin[u.uid]} isMe={me && me === u.uid} readOnly={readOnly}
            open={open === u.uid} onToggle={() => setOpen((o) => (o === u.uid ? null : u.uid))} onAsk={ask} />
        ))}
      </div>
    </>
  );
}

function UserRow({ u, now, first, rec, isMe, readOnly, open, onToggle, onAsk }) {
  const [acting, setActing] = useState(null);   // 'close' | 'purge'
  const st = statusOf(u, now);
  const a = adminStateOf(rec);
  const label = u.name || (u.email ?? '').split('@')[0] || 'Unnamed';
  const untracked = u.opens == null && u.entries == null;
  const quiet = daysQuiet(u, now);
  const canClose = !readOnly && !isMe && !['closed', 'closing', 'restoring', 'purging', 'leaving', 'purged'].includes(a);
  const send = async (state, note, opts) => { if (await onAsk(u.uid, state, note, opts)) setActing(null); };

  return (
    <div className="admin-user" style={{ borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <button type="button" id={`admin-user-${u.uid}`} onClick={onToggle} aria-expanded={open}
        style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', border: 'none', background: open ? 'var(--surface2)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, position: 'relative' }}>
          {label.slice(0, 1).toUpperCase()}
          <span title={STATUS[st].label} style={{ position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: 5, background: `var(--${STATUS[st].tone})`, border: '2px solid var(--surface)' }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email || '—'}</span>
          <StateLine a={a} rec={rec} now={now} />
        </span>
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: 'var(--text-secondary)' }}>{agoLabel(u.lastOpenedAt, now)}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)' }}>{untracked ? 'never opened' : `${(Number(u.entries) || 0).toLocaleString('en-IN')} entries`}</span>
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div id={`admin-details-${u.uid}`} style={{ padding: '4px 12px 12px 54px', background: 'var(--surface2)' }}>
          <Details u={u} now={now} untracked={untracked} />
          {!acting && !readOnly && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {u.email && <a id={`admin-mail-${u.uid}`} href={mailto(u, quiet)} style={{ ...btn(), textDecoration: 'none' }}><Mail size={12} /> Mail</a>}
              {canClose && <button type="button" id={`admin-close-${u.uid}`} onClick={() => setActing('close')} style={btn('expense')}><UserX size={12} /> Close account</button>}
              {a === 'closing' && <button type="button" onClick={() => send('cancelled')} style={btn()}><X size={12} /> Cancel closing</button>}
              {a === 'closed' && <button type="button" id={`admin-restore-${u.uid}`} onClick={() => send('restore_requested')} style={btn('income', true)}><RotateCcw size={12} /> Restore</button>}
              {a === 'closed' && <button type="button" id={`admin-purge-${u.uid}`} onClick={() => setActing('purge')} style={btn('expense')}><Trash2 size={12} /> Delete forever</button>}
            </div>
          )}
          {acting && <Confirm u={u} kind={acting} quiet={quiet} onCancel={() => setActing(null)}
            onConfirm={(note) => send(acting === 'close' ? 'delete_requested' : 'purge_requested', note, { force: acting === 'close' && quiet < INACTIVE_DAYS })} />}
        </div>
      )}
    </div>
  );
}

/* Account details — how they use the app, never their money or entries */
function Details({ u, now, untracked }) {
  const yes = (v) => (v == null ? '—' : v ? 'Yes' : 'No');
  const rows = [
    ['Joined', u.createdAt ? `${new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${agoLabel(u.createdAt, now)}` : '—'],
    ['Last opened', agoLabel(u.lastOpenedAt, now)],
    ['Last entry', agoLabel(u.lastEntryAt, now)],
    ['Entries', untracked ? '—' : (Number(u.entries) || 0).toLocaleString('en-IN')],
    ['Opens', u.opens != null ? Number(u.opens).toLocaleString('en-IN') : '—'],
    ['Days used', u.activeDays != null ? String(u.activeDays) : '—'],
    ['App', u.platform ? `${u.platform}${u.version ? ` ${u.version}` : ''}` : '—'],
    ['Sign-in', u.provider ?? '—'],
    ['Email verified', yes(u.verified)],
    ['Devices', u.devices != null ? `${u.devices} of 3` : '—'],
    ['Recurring rules', u.rules != null ? String(u.rules) : '—'],
    ['App lock', yes(u.lockOn)],
    ['Theme · language', [u.theme, u.lang].filter(Boolean).join(' · ') || '—'],
  ];
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '6px 0 0', fontSize: 12 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--text-muted)' }}>{k}</dt>
          <dd style={{ margin: 0, color: 'var(--text)', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function StateLine({ a, rec, now }) {
  const line = {
    closing: ['lent', rec?.force ? 'Closing (still active) — waiting for the server' : 'Closing — waiting for the server'],
    restoring: ['lent', 'Restoring — waiting for the server'],
    purging: ['lent', 'Deleting forever — waiting for the server'],
    leaving: ['lent', 'Deleted their account — the server is finishing it'],
    purged: ['expense', 'Account deleted'],
    closed: ['expense', `Closed ${agoLabel(rec?.deletedAt, now)} · kept until ${rec?.purgeAfter ? new Date(rec.purgeAfter).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `${KEEP_DAYS} days`}`],
    refused: ['expense', `Not closed: ${rec?.error ?? 'the server refused'}`],
  }[a];
  const err = a !== 'refused' && rec?.error;
  if (!line && !err) return null;
  return (
    <span style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 650, color: `var(--${line?.[0] ?? 'expense'})`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {line ? line[1] : `Last step failed: ${rec.error}`}
    </span>
  );
}

/* Typing their email is the confirmation — and a reminder to have told them first */
function Confirm({ u, kind, quiet, onCancel, onConfirm }) {
  const [told, setTold] = useState(false);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const close = kind === 'close';
  const active = close && quiet < INACTIVE_DAYS;
  const want = String(u.email || u.uid).toLowerCase();
  const ok = (!close || told) && typed.trim().toLowerCase() === want;
  return (
    <div id="admin-confirm" style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1.5px solid var(--expense-border)', background: 'var(--expense-bg)', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{close ? `Close ${u.name || u.email}’s account?` : `Delete ${u.name || u.email} forever?`}</div>
      <div style={{ ...muted, color: 'var(--text-secondary)' }}>
        {close
          ? `${active ? `They opened the app ${quiet === 0 ? 'today' : `${quiet} days ago`} — they’ll be signed out everywhere.` : `Not opened for ${quiet} days.`} Sign-in is switched off and their data is moved aside and kept ${KEEP_DAYS} days — Restore brings everything back. After that it is deleted for good.`
          : 'The kept data and the account are removed for good. This can’t be undone.'}
      </div>
      {close && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={told} onChange={(e) => setTold(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--expense)' }} />
          <span>{active ? 'They asked me to close it, or I told them and they’re fine with it' : 'I called or mailed them and they’re fine with it'}</span>
        </label>
      )}
      {close && <input id="admin-confirm-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Note for yourself (optional)" style={{ ...fieldStyle, fontSize: 12.5 }} />}
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
  const body = quiet >= INACTIVE_DAYS
    ? `Hi ${name},\n\nYou signed up for Expense Tracker but haven’t opened it for ${quiet} days. I’m tidying up unused accounts — is it OK if I close yours?\n\nIf you’d like to keep it, just open the app or reply to this mail. If I close it, your data is kept for ${KEEP_DAYS} days and I can bring it back if you change your mind.\n\nThanks,\nThrishank`
    : `Hi ${name},\n\n`;
  return `mailto:${encodeURIComponent(u.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ═════ Inbox ═════ */
function InboxView({ items, setItems, now, readOnly }) {
  const [show, setShow] = useState('new');
  if (!items) return <div style={{ marginTop: 12, ...muted }}>Loading…</div>;
  const list = items.filter((f) => (show === 'new' ? f.status !== 'done' : f.status === 'done'));
  const set = (id, patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <div id="admin-inbox" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[['new', `Open · ${items.filter((f) => f.status !== 'done').length}`], ['done', 'Done']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setShow(k)} style={{ ...btn(show === k ? 'accent' : 'text-secondary'), background: show === k ? 'var(--accent-bg)' : 'transparent', borderColor: show === k ? 'var(--accent-border)' : 'var(--border)' }}>{l}</button>
        ))}
      </div>
      {list.length === 0 && <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', ...muted }}>{show === 'new' ? 'Nothing waiting. New reports also reach you as a notification and an email.' : 'Nothing marked done yet.'}</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {list.map((f) => {
          const kind = FEEDBACK_KINDS[f.kind] ?? FEEDBACK_KINDS.other;
          return (
            <div key={f.id} className="admin-feedback" style={{ padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: `var(--${kind.tone}-bg, var(--surface2))`, color: `var(--${kind.tone})` }}>{kind.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || f.email || 'Someone'}</span>
                <span style={{ marginLeft: 'auto', ...muted }}>{agoLabel(f.createdAt, now)}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: '8px 0 6px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.text}</p>
              <div style={{ ...muted, fontSize: 11 }}>{[f.page && `on ${f.page}`, f.platform && `${f.platform} ${f.version ?? ''}`.trim(), f.device].filter(Boolean).join(' · ')}</div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.email && <a href={`mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(`Re: your ${kind.label.toLowerCase()} — Expense Tracker`)}&body=${encodeURIComponent(`Hi ${(f.name || '').split(' ')[0] || 'there'},\n\nThanks for writing in.\n\n> ${String(f.text).slice(0, 400)}\n\n`)}`} style={{ ...btn(), textDecoration: 'none' }}><Mail size={12} /> Reply</a>}
                  {f.status !== 'done'
                    ? <button type="button" onClick={() => markFeedback(f.id, 'done').then(() => set(f.id, { status: 'done' }), () => {})} style={btn('income')}><Check size={12} /> Done</button>
                    : <button type="button" onClick={() => markFeedback(f.id, 'seen').then(() => set(f.id, { status: 'seen' }), () => {})} style={btn()}><RotateCcw size={12} /> Reopen</button>}
                  <button type="button" aria-label="Delete" onClick={() => removeFeedback(f.id).then(() => setItems((xs) => xs.filter((x) => x.id !== f.id)), () => {})} style={btn('expense')}><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════ Health ═════ */
function Health({ user, readOnly, job }) {
  const [h, setH] = useState(null);
  const [checks, setChecks] = useState(null);
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  // Only sets state once the checks answer (never synchronously in the effect)
  const load = useCallback(() => Promise.all([getHealth().catch(() => ({})), user ? liveChecks(user, !readOnly) : Promise.resolve([])])
    .then(([health, live]) => { setH(health); setChecks(live); setNow(Date.now()); setBusy(false); }), [user, readOnly]);
  useEffect(() => { load(); }, [load]);
  // A run that finishes refreshes what it wrote
  const lastRun = job?.runs?.[0];
  const doneKey = lastRun?.status === 'completed' ? lastRun.id : null;
  useEffect(() => { if (doneKey) load(); }, [doneKey, load]);
  const run = () => { setBusy(true); load(); };
  const n = h?.notifier;
  const late = n && now - n.at > 45 * 60e3;
  const running = n?.running && now - n.running.at < 15 * 60e3 ? n.running : null;
  const days = Object.entries(h?.usage?.days ?? {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
  const quota = h?.usage?.quota ?? { reads: 50000, writes: 20000, deletes: 20000 };
  const today = days[0]?.[1];

  return (
    <div id="admin-health" style={{ marginTop: 12, display: 'grid', gap: 12 }}>
      <Panel title="Server job (notifier)" Icon={Server}>
        {running && <Light ok label="Running now" value={`started ${agoLabel(running.at, now)}`} />}
        {!n && !running && <div style={muted}>No run recorded yet.</div>}
        {n && (
          <>
            <Light ok={n.ok && !late} label={late ? 'Late — GitHub hasn’t started it for a while' : n.ok ? 'Last run fine' : `Last run had errors: ${(n.errors ?? []).join(', ')}`} value={`${agoLabel(n.at, now)} · ${Math.round((n.ms ?? 0) / 1000)} s`} />
            {Object.entries(n.jobs ?? {}).map(([k, j]) => <Light key={k} small ok={j.ok} label={k} value={j.ok ? `${j.ms} ms` : j.error} />)}
            {n.history?.length > 1 && (
              <div aria-label="Last runs" style={{ display: 'flex', gap: 2, marginTop: 8 }}>
                {[...n.history].reverse().map((r) => <span key={r.at} title={`${new Date(r.at).toLocaleString('en-IN')} · ${r.ok ? 'ok' : r.errors?.join(', ')}`} style={{ flex: 1, height: 16, borderRadius: 3, background: r.ok ? 'var(--income)' : 'var(--expense)', opacity: r.ok ? 0.55 : 1 }} />)}
              </div>
            )}
            <div style={{ ...muted, marginTop: 6 }}>{[n.stats?.accounts != null && `${n.stats.accounts} sign-in accounts`, n.stats?.closed && `${n.stats.closed} closed`, n.stats?.alerts && `${n.stats.alerts} alerts`, n.stats?.emails && `${n.stats.emails} emails`, n.stats?.feedback && `${n.stats.feedback} reports forwarded`].filter(Boolean).join(' · ')}</div>
          </>
        )}
        {!readOnly && job && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}><ServerJobRuns job={job} now={now} /></div>}
      </Panel>

      <Panel title="Firestore usage (free daily quota)" Icon={Database}>
        {h?.usage?.error && (/billing/i.test(h.usage.error) ? (
            <div id="admin-usage-billing" style={{ ...muted, color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>Not available on the free plan</div>
              Google only gives read / write counts to programs on projects with a billing account (Blaze). The app doesn’t need one — see today’s numbers in the{' '}
              <a href={`https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/usage`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>Firebase console → Firestore → Usage</a>.
              {' '}The Monitoring Viewer role you added is right; if you ever move to Blaze, the meters fill in here by themselves.
            </div>
          ) : /Monitoring Viewer/.test(h.usage.error) ? <MonitoringHelp project={PROJECT} />
          : /switched off/.test(h.usage.error) ? (
            <div style={{ ...muted, color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 700, color: 'var(--lent)' }}>{h.usage.error}</div>
              <a href={`https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=${PROJECT}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>Turn on Cloud Monitoring API</a> (Enable), then Run now — it can take a few minutes to apply.
            </div>
          ) : <div style={{ ...muted, color: 'var(--lent)' }}>{h.usage.error}</div>)}
        {h?.usage?.detail && !/billing/i.test(h.usage.error ?? '') && <div id="admin-usage-detail" style={{ ...muted, fontSize: 10.5, marginTop: 6, overflowWrap: 'anywhere' }}>Google said: {h.usage.detail}</div>}
        {!h?.usage && <div style={muted}>Not measured yet — the server job adds it on its next run.</div>}
        {today && (
          <>
            <Meter label="Reads today" value={today.reads} max={quota.reads} />
            <Meter label="Writes today" value={today.writes} max={quota.writes} />
            <Meter label="Deletes today" value={today.deletes} max={quota.deletes} />
            <table style={{ width: '100%', marginTop: 10, fontSize: 11.5, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 600 }}>Day (Pacific)</th><th style={{ fontWeight: 600 }}>Reads</th><th style={{ fontWeight: 600 }}>Writes</th><th style={{ fontWeight: 600 }}>Deletes</th></tr></thead>
              <tbody>{days.map(([d, v]) => <tr key={d} style={{ textAlign: 'right', color: 'var(--text)' }}><td style={{ textAlign: 'left', padding: '3px 0' }}>{d}</td><td>{v.reads.toLocaleString('en-IN')}</td><td>{v.writes.toLocaleString('en-IN')}</td><td>{v.deletes.toLocaleString('en-IN')}</td></tr>)}</tbody>
            </table>
            <div style={{ ...muted, marginTop: 6 }}>Measured {agoLabel(h.usage.at, now)}. The quota resets at midnight Pacific time (1:30 pm in India).</div>
          </>
        )}
      </Panel>

      <Panel title="Live checks from this device" Icon={Radio} action={<button type="button" onClick={run} disabled={busy} style={btn()}><RefreshCw size={12} className={busy ? 'spin' : undefined} /> Run again</button>}>
        {!checks && <div style={muted}>Checking…</div>}
        {checks?.map((c) => <Light key={c.name} ok={c.ok} label={c.name} value={c.ok ? `${c.ms} ms · ${c.note}` : c.note} />)}
      </Panel>
    </div>
  );
}

/* ═════ Insights ═════ */
function InsightsView({ users, now, inbox }) {
  const i = useMemo(() => insights(users, now), [users, now]);
  const crashes = (inbox ?? []).filter((f) => (f.kind === 'crash' || f.kind === 'bug') && f.status === 'new').length;
  const who = (u) => u.name || u.email || u.uid;
  return (
    <div id="admin-insights" style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <Panel title="Features in use">
        <div style={muted}>Out of people whose app reports it (4.5.3 and later report all of these).</div>
        {i.adoption.map((r) => <Bar key={r.key} label={r.label} count={r.count} of={r.of} />)}
      </Panel>

      <Panel title={`App versions${i.latest ? ` · newest ${i.latest}` : ''}`}>
        <div style={muted}>{i.behind ? `${i.behind} ${i.behind === 1 ? 'person is' : 'people are'} on an older version — Android and desktop update themselves on the next open; the website on reload.` : 'Everyone is on the newest version.'}</div>
        <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>
          {i.versions.map((v) => (
            <div key={`${v.version}|${v.platform}`} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '3px 0' }}>
              <span style={{ fontWeight: 700, color: v.behind ? 'var(--lent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums', minWidth: 52 }}>{v.version}</span>
              <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{v.platform}</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{v.count}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Looks · platforms · languages">
        {[['Look', i.looks], ['Platform', i.platforms], ['Language', i.languages]].map(([label, list]) => (
          <div key={label} style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{label}: </span>
            <span style={{ color: 'var(--text)' }}>{list.map((x) => `${x.value} ${x.count} (${x.pct}%)`).join(' · ')}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Data health">
        <Light ok={i.wiped.length === 0} label="Settings look wiped" value={i.wiped.length ? `${i.wiped.length} ${i.wiped.length === 1 ? 'person' : 'people'}` : 'none'} />
        {i.wiped.length > 0 && <div style={{ ...muted, margin: '2px 0 4px 23px' }}>Almost no settings but a real history — likely lost to the settings wipe in 4.4.0–4.5.0 (fixed in 4.5.1). Their entries are safe; budgets, goals, accounts and layout need setting again.</div>}
        {i.wiped.slice(0, 20).map((u) => <Light key={u.uid} small ok={false} label={who(u)} value={`${Number(u.entries) || 0} entries · ${agoLabel(u.lastOpenedAt, now)}`} />)}
        <Light ok={i.problems.length === 0} label="Problems this week" value={i.problems.length ? `${i.problems.length} ${i.problems.length === 1 ? 'person' : 'people'}` : 'none'} />
        {i.problems.slice(0, 20).map((u) => <Light key={u.uid} small ok={false} label={who(u)} value={`${u.lastErr ?? 'error'} · ${agoLabel(u.lastErrAt, now)}${Number(u.errCount) > 1 ? ` · ${u.errCount}×` : ''}`} />)}
        <Light ok={crashes === 0} label="Unread crash / problem reports" value={crashes ? `${crashes} in Inbox` : 'none'} />
      </Panel>
    </div>
  );
}
function Bar({ label, count, of }) {
  const pct = of ? Math.round((count / of) * 100) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', fontSize: 11.5, marginBottom: 3 }}>
        <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{of ? `${count} of ${of} · ${pct}%` : 'not reported yet'}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} /></div>
    </div>
  );
}

function Light({ ok, label, value, small }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: small ? '2px 0 2px 22px' : '4px 0', fontSize: small ? 11.5 : 12.5 }}>
      {!small && <Icon size={15} style={{ color: ok ? 'var(--income)' : 'var(--expense)', flexShrink: 0 }} />}
      {small && <span style={{ width: 6, height: 6, borderRadius: 3, background: ok ? 'var(--income)' : 'var(--expense)', flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontWeight: small ? 500 : 650 }}>{label}</span>
      <span style={{ color: ok ? 'var(--text-muted)' : 'var(--expense)', fontSize: 11.5, textAlign: 'right', overflowWrap: 'anywhere', maxWidth: '55%' }}>{value}</span>
    </div>
  );
}
function Meter({ label, value, max }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const tone = pct >= 90 ? 'expense' : pct >= 70 ? 'lent' : 'income';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', fontSize: 11.5, marginBottom: 3 }}>
        <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: `var(--${tone})`, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString('en-IN')} / {max.toLocaleString('en-IN')} · {pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: `var(--${tone})` }} /></div>
    </div>
  );
}

/* ═════ Team (owner only) ═════ */
function Team() {
  const [viewers, setViewers] = useState(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => { getTeam().then(setViewers, () => setViewers([])); }, []);
  const save = async (next) => {
    try { setViewers(await saveTeam(next)); setMsg(null); } catch (e) { setMsg(e?.code === 'permission-denied' ? 'The rules refused — deploy the new firestore.rules first.' : 'Couldn’t save — check your connection.'); }
  };
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  return (
    <div id="admin-team" style={{ marginTop: 12 }}>
      <p style={{ ...muted, margin: '0 0 10px' }}>Trustees see everything here — people, inbox and health — but can’t close accounts, answer the inbox or change this list. They need a verified email (Google sign-in counts). Up to 10.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) { save([...(viewers ?? []), email]); setEmail(''); } }} style={{ display: 'flex', gap: 8 }}>
        <input id="admin-team-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trustee@email.com" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
        <button type="submit" disabled={!valid} style={{ ...btn('accent', true), opacity: valid ? 1 : 0.5 }}><Plus size={13} /> Add</button>
      </form>
      {msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--expense)' }}>{msg}</div>}
      <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {viewers == null && <div style={{ padding: 12, ...muted }}>Loading…</div>}
        {viewers?.length === 0 && <div style={{ padding: 12, ...muted }}>Only you, for now.</div>}
        {viewers?.map((v, i) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <ShieldCheck size={14} style={{ color: 'var(--income)' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', overflowWrap: 'anywhere' }}>{v}</span>
            <button type="button" aria-label={`Remove ${v}`} onClick={() => save(viewers.filter((x) => x !== v))} style={btn('expense')}><X size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
