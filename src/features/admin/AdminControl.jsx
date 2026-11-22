// ─── Admin sees → Control, and the server job from the app ───────
// Control (owner): banners on everyone's Home, a maintenance screen, the
// minimum app version — all in app_config/live (services/liveConfig).
// Server job: run the notifier now, watch its runs and cancel a stuck one,
// without leaving the app. It needs a GitHub token (fine-grained, this
// repository only, "Actions: read and write"), kept in admin_secrets/github
// where only the owner's account can read it.
import { useEffect, useState } from 'react';
import { muted, btn } from './adminUi';
import { Play, RefreshCw, Megaphone, Wrench, ShieldAlert, Trash2, Plus, KeyRound, CircleCheck, CircleAlert, Loader2, X, Save, ExternalLink, Eye } from 'lucide-react';
import { getLive, saveLive, REPO, NOTIFIER } from '../../services/liveConfig';
import { THIS_VERSION } from '../../native/updates';
import { compareVersions, agoLabel } from '../../utils/adminUsers';
import { generateId } from '../../utils/storage';
import { fieldStyle } from '../../components/formTokens';

export function Panel({ id, title, Icon, action, children }) {
  return (
    <section id={id} className="admin-panel" style={{ padding: 14, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {Icon && <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={14} /></span>}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ═════ The server job, from the app ═════ */
const RUNS_URL = `https://github.com/${REPO}/actions/workflows/${NOTIFIER}`;

const RUN_TONE = (r) => (r.status !== 'completed' ? 'accent' : r.conclusion === 'success' ? 'income' : r.conclusion === 'cancelled' || r.conclusion === 'skipped' ? 'lent' : 'expense');
const RUN_LABEL = (r) => (r.status === 'queued' ? 'Queued' : r.status === 'in_progress' ? 'Running' : r.status !== 'completed' ? r.status : { success: 'Done', failure: 'Failed', cancelled: 'Cancelled — took too long', skipped: 'Skipped', timed_out: 'Timed out' }[r.conclusion] ?? r.conclusion);

/** A "Run now" button for anywhere (People's pending note, Health). */
export function RunNowButton({ job, label = 'Run now' }) {
  if (!job.token) return <a href={RUNS_URL} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}>{label} on GitHub <ExternalLink size={11} /></a>;
  return (
    <button type="button" id="admin-run-now" onClick={job.run} disabled={job.busy || job.active} style={{ ...btn('accent', true), opacity: job.busy || job.active ? 0.6 : 1 }}>
      {job.busy || job.active ? <Loader2 size={12} className="spin" /> : <Play size={12} />} {job.active ? 'Running…' : label}
    </button>
  );
}

export function ServerJobRuns({ job, now }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (job.token === null) return <div style={muted}>Loading…</div>;
  if (!job.token || editing) {
    return (
      <div id="admin-token" style={{ display: 'grid', gap: 8 }}>
        <div style={{ ...muted, color: 'var(--text-secondary)' }}>
          To run the job from here, give the app a GitHub token once:
          <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>GitHub → Settings → Developer settings → <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>Fine-grained tokens → Generate new</a></li>
            <li>Repository access: <strong>Only select repositories</strong> → {REPO.split('/')[1]}</li>
            <li>Permissions → Repository → <strong>Actions: Read and write</strong> (nothing else)</li>
            <li>Paste it below. Only your account can read it back.</li>
          </ol>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="admin-token-input" type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="github_pat_…" autoComplete="off" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
          <button type="button" disabled={!draft.trim()} onClick={async () => { await job.saveToken(draft); setDraft(''); setEditing(false); }} style={{ ...btn('accent', true), opacity: draft.trim() ? 1 : 0.5 }}><KeyRound size={12} /> Save</button>
          {editing && <button type="button" onClick={() => setEditing(false)} style={btn()}><X size={12} /></button>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <RunNowButton job={job} />
        <button type="button" onClick={() => job.refresh()} style={btn()}><RefreshCw size={12} /> Refresh</button>
        <button type="button" onClick={() => setEditing(true)} style={btn()}><KeyRound size={12} /> Token</button>
      </div>
      {job.error && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--expense)' }}>{job.error}</div>}
      <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
        {(job.runs ?? []).map((r) => {
          const tone = RUN_TONE(r);
          const took = r.run_started_at && r.updated_at && r.status === 'completed' ? Math.round((Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 1000) : null;
          return (
            <div key={r.id} className="admin-run" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--${tone})`, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: `var(--${tone})`, minWidth: 0 }}>{RUN_LABEL(r)}</span>
              <span style={{ flex: 1, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.event === 'workflow_dispatch' ? 'by you' : 'scheduled'} · {agoLabel(Date.parse(r.created_at), now)}{took != null ? ` · ${took} s` : ''}
              </span>
              {r.status !== 'completed' && <button type="button" onClick={() => job.cancel(r.id)} style={{ ...btn('expense'), padding: '3px 8px' }}>Cancel</button>}
              <a href={r.html_url} target="_blank" rel="noreferrer" aria-label="Open on GitHub" style={{ color: 'var(--text-muted)', display: 'flex' }}><ExternalLink size={12} /></a>
            </div>
          );
        })}
        {job.runs?.length === 0 && <div style={muted}>No runs yet.</div>}
      </div>
      <div style={muted}>GitHub starts the schedule every 10 minutes when it can — on a free account it is often hours apart. Run it here when you’re waiting on something.</div>
    </div>
  );
}

/* ═════ Control (owner): banners, maintenance, minimum version ═════ */
const TONES = [['info', 'Info'], ['new', 'New'], ['warn', 'Heads-up']];
const PLATFORMS = [['android', 'Android'], ['web', 'Website'], ['desktop', 'Desktop']];
const toDateInput = (ms) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60e3).toISOString().slice(0, 16) : '');
const fromDateInput = (v) => (v ? new Date(v).getTime() : null);

export function ControlView() {
  const [cfg, setCfg] = useState(null);
  const [saved, setSaved] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { getLive().then((c) => { setCfg(c); setSaved(JSON.stringify(c)); }, () => setMsg('Couldn’t load — check your connection, and that the new rules are deployed.')); }, []);
  if (!cfg) return <div style={{ ...muted, marginTop: 12 }}>{msg ?? 'Loading…'}</div>;

  const dirty = JSON.stringify(cfg) !== saved;
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const minOk = !cfg.minVersion || (/^\d+\.\d+\.\d+$/.test(cfg.minVersion) && compareVersions(cfg.minVersion, THIS_VERSION) <= 0);
  async function save() {
    if (!minOk) return;
    setSaving(true);
    try { const c = await saveLive(cfg); const next = { ...cfg, ...c, updatedAt: undefined }; setCfg(next); setSaved(JSON.stringify(next)); setMsg('Saved — open apps pick it up within seconds.'); }
    catch (e) { setMsg(e?.code === 'permission-denied' ? 'The rules refused — deploy the new firestore.rules first.' : 'Couldn’t save — check your connection.'); }
    finally { setSaving(false); }
  }

  return (
    <div id="admin-control" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <BannersPanel banners={cfg.banners ?? []} onChange={(banners) => set({ banners })} />

      <Panel id="admin-maintenance" title="Maintenance" Icon={Wrench}
        action={<Switch id="admin-maint-switch" on={!!cfg.maintenance?.on} onChange={(on) => set({ maintenance: { ...cfg.maintenance, on } })} />}>
        <div style={muted}>Everyone but you sees a “back in a little while” screen until you switch it off (or the time below passes). Their data isn’t touched.</div>
        {cfg.maintenance?.on && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <textarea id="admin-maint-msg" value={cfg.maintenance?.message ?? ''} maxLength={400} rows={2} onChange={(e) => set({ maintenance: { ...cfg.maintenance, message: e.target.value } })}
              placeholder="Moving to a faster database — back by 9 pm." style={{ ...fieldStyle, resize: 'vertical' }} />
            <label style={{ ...muted, display: 'grid', gap: 4 }}>Ends by itself at (optional)
              <input type="datetime-local" value={toDateInput(cfg.maintenance?.until)} onChange={(e) => set({ maintenance: { ...cfg.maintenance, until: fromDateInput(e.target.value) } })} style={fieldStyle} />
            </label>
          </div>
        )}
      </Panel>

      <Panel id="admin-minversion" title="Minimum app version" Icon={ShieldAlert}>
        <div style={muted}>Apps older than this ask people to update before anything else — for a fix that matters (a data bug). Android and desktop update in place; the website reloads. You’re on {THIS_VERSION}; it can’t be set above that.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input id="admin-minversion-input" value={cfg.minVersion ?? ''} onChange={(e) => set({ minVersion: e.target.value.trim() })} placeholder="e.g. 4.5.1 — empty: off" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
          {cfg.minVersion && <button type="button" onClick={() => set({ minVersion: '' })} style={btn()}><X size={12} /> Off</button>}
        </div>
        {!minOk && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--expense)', marginTop: 6 }}>Use a version like 4.5.1, no newer than {THIS_VERSION} — otherwise nobody could get in.</div>}
        {cfg.minVersion && minOk && (
          <input value={cfg.minMessage ?? ''} maxLength={300} onChange={(e) => set({ minMessage: e.target.value })} placeholder="Why (optional) — “4.5.1 fixes settings being wiped.”" style={{ ...fieldStyle, marginTop: 8 }} />
        )}
      </Panel>

      <div style={{ position: 'sticky', bottom: 8, display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: dirty ? 'var(--shadow-md)' : 'none' }}>
        <span style={{ flex: 1, ...muted, color: msg?.startsWith('Saved') ? 'var(--income)' : msg ? 'var(--expense)' : 'var(--text-muted)' }}>{msg ?? (dirty ? 'Not saved yet.' : 'Everything is live.')}</span>
        <button type="button" id="admin-control-save" onClick={save} disabled={!dirty || saving || !minOk} style={{ ...btn('accent', true), opacity: dirty && minOk ? 1 : 0.5 }}>
          {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />} Publish
        </button>
      </div>
    </div>
  );
}

function BannersPanel({ banners, onChange }) {
  const [draft, setDraft] = useState(null);
  const [now] = useState(() => Date.now());
  const start = () => setDraft({ id: generateId(), text: '', tone: 'info', platforms: null, until: null, link: '', linkLabel: '', dismissible: true });
  return (
    <Panel id="admin-banners" title={`Banners on Home · ${banners.length}`} Icon={Megaphone}
      action={!draft && banners.length < 5 && <button type="button" id="admin-banner-new" onClick={start} style={btn('accent')}><Plus size={12} /> New</button>}>
      <div style={muted}>A note at the top of everyone’s Home — what’s new, a heads-up, a thank-you. People can dismiss it unless you say otherwise. Up to five.</div>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {banners.map((b) => {
          const over = b.until && b.until < now;
          return (
            <div key={b.id} className="admin-banner-row" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 12, background: 'var(--surface2)', opacity: over ? 0.55 : 1 }}>
              <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: 'var(--surface)', color: b.tone === 'warn' ? 'var(--lent)' : b.tone === 'new' ? 'var(--income)' : 'var(--accent)', flexShrink: 0 }}>{TONES.find(([k]) => k === b.tone)?.[1] ?? 'Info'}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflowWrap: 'anywhere' }}>
                {b.text}
                <span style={{ display: 'block', ...muted, fontSize: 11 }}>
                  {[b.platforms ? b.platforms.join(', ') : 'everyone', over ? 'ended' : b.until ? `until ${new Date(b.until).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'no end', b.dismissible === false ? 'stays' : 'dismissible'].join(' · ')}
                </span>
              </span>
              <button type="button" aria-label="Edit banner" onClick={() => setDraft({ ...b, link: b.link ?? '', linkLabel: b.linkLabel ?? '' })} style={{ ...btn(), padding: '4px 8px' }}>Edit</button>
              <button type="button" aria-label="Remove banner" onClick={() => onChange(banners.filter((x) => x.id !== b.id))} style={{ ...btn('expense'), padding: '4px 8px' }}><Trash2 size={12} /></button>
            </div>
          );
        })}
        {!banners.length && !draft && <div style={{ ...muted, padding: '4px 0' }}>No banners — Home is as people left it.</div>}
      </div>

      {draft && (
        <div id="admin-banner-draft" style={{ display: 'grid', gap: 8, marginTop: 10, padding: 12, borderRadius: 12, border: '1.5px solid var(--accent-border, var(--border))' }}>
          <textarea id="admin-banner-text" value={draft.text} maxLength={400} rows={3} autoFocus onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="New in 4.6: Goals has its own page — plan a purchase, item by item." style={{ ...fieldStyle, resize: 'vertical' }} />
          <Chips label="Kind" options={TONES} value={[draft.tone]} onToggle={(k) => setDraft({ ...draft, tone: k })} />
          <Chips label="Who" options={PLATFORMS} value={draft.platforms ?? PLATFORMS.map(([k]) => k)}
            onToggle={(k) => { const cur = draft.platforms ?? PLATFORMS.map(([p]) => p); const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]; setDraft({ ...draft, platforms: next.length === PLATFORMS.length || !next.length ? null : next }); }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="Link (optional) https://…" style={fieldStyle} />
            <input value={draft.linkLabel} maxLength={40} onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })} placeholder="Link text — “See how”" style={fieldStyle} />
          </div>
          <label style={{ ...muted, display: 'grid', gap: 4 }}>Ends at (optional)
            <input type="datetime-local" value={toDateInput(draft.until)} onChange={(e) => setDraft({ ...draft, until: fromDateInput(e.target.value) })} style={fieldStyle} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            <input type="checkbox" checked={draft.dismissible !== false} onChange={(e) => setDraft({ ...draft, dismissible: e.target.checked })} /> People can dismiss it
          </label>
          {draft.text.trim() && (
            <div style={{ ...muted }}><Eye size={11} style={{ verticalAlign: -1 }} /> Shows at the top of Home, above everything else.</div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" id="admin-banner-add" disabled={!draft.text.trim() || (draft.link && !/^https?:\/\//.test(draft.link))}
              onClick={() => { const b = { ...draft, text: draft.text.trim(), link: draft.link.trim() || null, linkLabel: draft.linkLabel.trim() || null, at: draft.at ?? Date.now() }; onChange(banners.some((x) => x.id === b.id) ? banners.map((x) => (x.id === b.id ? b : x)) : [...banners, b]); setDraft(null); }}
              style={{ ...btn('accent', true), opacity: draft.text.trim() ? 1 : 0.5 }}><CircleCheck size={12} /> Keep</button>
            <button type="button" onClick={() => setDraft(null)} style={btn()}>Cancel</button>
          </div>
          <div style={muted}>“Keep” adds it to the list — Publish below sends it to everyone.</div>
        </div>
      )}
    </Panel>
  );
}

function Chips({ label, options, value, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ ...muted, width: 34 }}>{label}</span>
      {options.map(([k, l]) => {
        const on = value.includes(k);
        return <button key={k} type="button" aria-pressed={on} onClick={() => onToggle(k)} style={{ ...btn(on ? 'accent' : 'text-secondary'), padding: '5px 10px', background: on ? 'var(--accent-bg)' : 'transparent', borderColor: on ? 'var(--accent)' : 'var(--border)' }}>{l}</button>;
      })}
    </div>
  );
}

function Switch({ id, on, onChange }) {
  return (
    <button type="button" id={id} role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 13, border: 'none', padding: 3, cursor: 'pointer', background: on ? 'var(--lent)' : 'var(--border-dark)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s' }}>
      <span style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

/* Monitoring Viewer, step by step (Health → Firestore usage) */
export function MonitoringHelp({ project }) {
  const iam = `https://console.cloud.google.com/iam-admin/iam?project=${project}`;
  return (
    <div id="admin-monitoring-help" style={{ ...muted, color: 'var(--text-secondary)', marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--lent)' }}><CircleAlert size={13} /> Reads and writes need one more permission</div>
      <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 3 }}>
        <li>Open <a href={iam} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>Google Cloud → IAM</a> for {project} (same Google account as Firebase).</li>
        <li>Find the service account the server job uses — <strong>firebase-adminsdk-…@{project}.iam.gserviceaccount.com</strong> — and tap the pencil.</li>
        <li>Add another role → type <strong>Monitoring Viewer</strong> → Save.</li>
        <li>Come back after the next server run (or Run now in Health) — the meters fill in.</li>
      </ol>
    </div>
  );
}
