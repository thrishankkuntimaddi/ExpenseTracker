// ─── Admin sees (owner account only) ─────────────────────────────
// Read-only: who uses the app, from user_activity — name, email, when they
// last opened it and last added an entry, how many entries, where. There is
// no way from here to open, change or delete anyone's data.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { listActivity } from '../../services/activity';
import { FILTERS, SORTS, STATUS, statusOf, viewUsers, summarise, agoLabel } from '../../utils/adminUsers';
import { fieldStyle } from '../../components/formTokens';

const PLATFORMS = [
  { key: 'all', label: 'All apps' }, { key: 'web', label: 'Web' }, { key: 'android', label: 'Android' }, { key: 'desktop', label: 'Desktop' },
];

export default function AdminCard({ users: given }) {
  const [users, setUsers] = useState(given ?? null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!given);
  const [filter, setFilter] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [sort, setSort] = useState('opened');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [showGone, setShowGone] = useState(false);   // people who stopped stay folded away until asked for

  const fetchList = useCallback(() => listActivity().then(
    (list) => { setUsers(list); setNow(Date.now()); setError(null); setLoading(false); },
    (e) => {
      setError(e?.code === 'permission-denied' ? 'This account can’t read the list (check the owner email in the rules).' : 'Couldn’t load the list — check your connection.');
      setLoading(false);
    },
  ), []);
  const load = () => { setLoading(true); fetchList(); };
  useEffect(() => { if (!given) fetchList(); }, [given, fetchList]);

  const sum = useMemo(() => summarise(users ?? [], now), [users, now]);
  const all = useMemo(() => viewUsers(users ?? [], { filter, platform, search, sort }, now), [users, filter, platform, search, sort, now]);
  // "Everyone" keeps the people still around on top and folds the stopped ones under one row
  const fold = filter === 'all' && !search.trim();
  const list = fold ? all.filter((u) => statusOf(u, now) !== 'gone') : all;
  const gone = fold ? all.filter((u) => statusOf(u, now) === 'gone') : [];
  const fdesc = FILTERS.find((f) => f.key === filter);

  return (
    <div id="admin-sees" style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        <Lock size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Read only — when people use the app, never what they spend. Every account is listed; ones that never opened an up-to-date app are added once a day.</span>
        <button id="admin-refresh" aria-label="Refresh" onClick={load} disabled={loading} style={{ width: 32, height: 32, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <RefreshCw size={14} className={loading ? 'spin' : undefined} />
        </button>
      </div>

      {error && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--expense)' }}>{error}</div>}

      {users && (
        <>
          <div className="admin-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
            <Tile label="All accounts" value={sum.total} />
            <Tile label="This week" value={sum.counts.active} tone="income" />
            <Tile label="Today" value={sum.counts.today} tone="income" />
            <Tile label="Stopped" value={sum.counts.gone} tone="expense" />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {sum.counts.new} new this week · {sum.returning} came back this week · {sum.counts.nodata} with no entries · {Object.entries(sum.platforms).map(([p, n]) => `${n} ${p}`).join(' · ')}
          </div>

          {/* Smart filters */}
          <div role="radiogroup" aria-label="Filter" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {FILTERS.map((f) => (
              <button key={f.key} id={`admin-filter-${f.key}`} role="radio" aria-checked={filter === f.key} onClick={() => setFilter(f.key)}
                style={{ padding: '6px 10px', fontSize: 12, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border)'}`, background: filter === f.key ? 'var(--accent-bg)' : 'transparent', color: filter === f.key ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {f.label} <span style={{ opacity: 0.7 }}>{sum.counts[f.key]}</span>
              </button>
            ))}
          </div>
          {fdesc?.hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{fdesc.hint}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input id="admin-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" style={{ ...fieldStyle, paddingLeft: 30 }} />
            </span>
            <select id="admin-platform" aria-label="App" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ ...fieldStyle, width: 'auto' }}>
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <select id="admin-sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...fieldStyle, width: 'auto' }}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
            {fold ? `${list.length} still around · ${gone.length} stopped · ${sum.total} accounts in all` : `${all.length} of ${sum.total} accounts`}
          </div>
          <div id="admin-list" style={{ marginTop: 6, border: '1px solid var(--border)' }}>
            {list.length === 0 && !gone.length && <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>Nobody here.</div>}
            {list.map((u, i) => <UserRow key={u.uid} u={u} now={now} first={i === 0} />)}
            {gone.length > 0 && (
              <>
                <button id="admin-show-stopped" type="button" aria-expanded={showGone} onClick={() => setShowGone((v) => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', borderTop: list.length ? '1px solid var(--border)' : 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                  {showGone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ flex: 1 }}>Stopped using it · {gone.length} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>— not opened for 30+ days</span></span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{showGone ? 'Hide' : 'Show'}</span>
                </button>
                {showGone && gone.map((u) => <UserRow key={u.uid} u={u} now={now} />)}
              </>
            )}
          </div>
        </>
      )}
      {!users && loading && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>}
    </div>
  );
}

function UserRow({ u, now, first }) {
  const st = statusOf(u, now);
  const label = u.name || (u.email ?? '').split('@')[0] || 'Unnamed';
  // Listed from the sign-in records only: this account never opened an app that reports activity
  const untracked = u.opens == null && u.entries == null;
  return (
    <div className="admin-user" style={{ display: 'flex', gap: 10, padding: '10px 12px', borderTop: first ? 'none' : '1px solid var(--border)', alignItems: 'flex-start' }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
        {label.slice(0, 1).toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span title={STATUS[st].label} style={{ width: 7, height: 7, borderRadius: 4, background: `var(--${STATUS[st].tone})`, flexShrink: 0 }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'all' }}>{u.email || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
          {untracked ? (
            <>Last signed in <strong style={{ color: 'var(--text-secondary)' }}>{agoLabel(u.lastOpenedAt, now)}</strong> · never opened an up-to-date app</>
          ) : (
            <>
              Opened <strong style={{ color: 'var(--text-secondary)' }}>{agoLabel(u.lastOpenedAt, now)}</strong>
              {' · '}last entry <strong style={{ color: 'var(--text-secondary)' }}>{agoLabel(u.lastEntryAt, now)}</strong>
              {' · '}{(Number(u.entries) || 0).toLocaleString('en-IN')} entries
              {' · '}{u.platform ?? 'web'}{u.version ? ` ${u.version}` : ''}
            </>
          )}
          {u.createdAt ? ` · joined ${agoLabel(u.createdAt, now)}` : ''}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }) {
  return (
    <div style={{ padding: '8px 10px', border: '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: tone ? `var(--${tone})` : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
