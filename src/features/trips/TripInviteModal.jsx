// ─── TripInviteModal ──────────────────────────────────────────────
// Bring friends onto a trip. Every way leads to the same link:
//   QR code (scan with a phone camera) · copy link · share to WhatsApp /
//   contacts (the phone's share sheet) · an invite email sent by the app
//   (a designed email with the trip and a Join button) or from your own mail
//   app · or add someone from friends you've shared trips with before.
// A personal trip becomes shared the first time — it moves to shared
// storage with all its rows; nothing else changes.
import { useEffect, useState } from 'react';
import { Copy, Check, Mail, Send, Link as LinkIcon, UserPlus, Loader2, UserCheck } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import Avatar from '../../components/Avatar';
import { inviteLink, inviteMessage, inviteMailto } from './invite';
import { saveInvitePreview, requestInviteEmail } from '../../services/sharedTrips';
import { auth } from '../../services/firebase';
import { generateId } from '../../utils/storage';

export default function TripInviteModal({ trip, friends = [], onMakeShared, onLinkFriend, onClose }) {
  if (!trip.shared) return <MakeShared trip={trip} onMakeShared={onMakeShared} onClose={onClose} />;
  return <Invite trip={trip} friends={friends} onLinkFriend={onLinkFriend} onClose={onClose} />;
}

function MakeShared({ trip, onMakeShared, onClose }) {
  const members = trip.members ?? [];
  const [me, setMe] = useState(trip.meMemberId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true); setError('');
    try { await onMakeShared({ ...trip, meMemberId: me }); }
    catch (err) { setError(err?.message || 'Could not share the trip. Check your connection and try again.'); setBusy(false); }
  }
  return (
    <ModalShell title="Invite friends" subtitle={`Everyone adds their own spending to “${trip.name}”.`} onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={go} disabled={!me || busy} color="var(--external)">{busy ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />} Share this trip</PrimaryButton>
      </>}
    >
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Your friends open the link, sign in (or create an account), pick their name and add what they spent.
        They <strong>see every row</strong> but <strong>change only their own</strong> — and their wallet partner’s. You can correct anything, close and reopen.
      </div>
      <Field label="Which one is you?">
        <select value={me} onChange={(e) => setMe(e.target.value)} style={fieldStyle}>
          <option value="">Pick your name…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      {error && <div style={{ fontSize: 12, color: 'var(--expense)' }}>{error}</div>}
    </ModalShell>
  );
}

function Invite({ trip, friends, onLinkFriend, onClose }) {
  const link = inviteLink(trip.id);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState('');
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    let live = true;
    import('qrcode').then((QR) => QR.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } }))
      .then((url) => { if (live) setQr(url); })
      .catch(() => {});
    return () => { live = false; };
  }, [link]);

  async function copy(what, text) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1600); } catch { /* clipboard blocked */ }
  }
  async function share() {
    try { await navigator.share({ title: `Join “${trip.name}”`, text: inviteMessage(trip, link) }); } catch { /* cancelled */ }
  }
  // What the link shows before signing in — kept current by the organiser
  useEffect(() => { if (trip.isOwner) saveInvitePreview(trip).catch(() => {}); }, [trip]);

  /* Invite by email: the app sends a designed email (Join button, what the app does) */
  const [emailOpen, setEmailOpen] = useState(false);
  const [to, setTo] = useState('');
  const [sent, setSent] = useState([]);
  const [mailError, setMailError] = useState('');
  async function sendEmail(e) {
    e.preventDefault();
    const addrs = to.split(/[\s,;]+/).map((a) => a.trim()).filter(Boolean);
    const bad = addrs.find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
    if (!addrs.length || bad) { setMailError(bad ? `“${bad}” isn’t an email address.` : 'Type an email address.'); return; }
    setMailError('');
    const me = auth?.currentUser;
    try {
      await Promise.all(addrs.slice(0, 10).map((a) => requestInviteEmail(me.uid, { to: a, tripId: trip.id, fromName: me.displayName || trip.ownerName || '' })));
      setSent((s) => [...s, ...addrs.slice(0, 10)]); setTo('');
    } catch { setMailError('Couldn’t send — check your connection and try again.'); }
  }

  const members = trip.members ?? [];
  const joined = new Set(Object.values(trip.uidMember ?? {}));
  const onTrip = new Set(trip.memberUids ?? []);
  const openSlots = members.filter((m) => !joined.has(m.id));
  const addable = friends.filter((f) => !onTrip.has(f.uid));

  return (
    <ModalShell title={`Invite to ${trip.name}`} subtitle="Scan, tap the link, or send it — they pick their name." onClose={onClose} maxWidth={500}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 150, height: 150, borderRadius: 14, background: '#fff', padding: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
          {qr ? <img src={qr} alt="QR code for the trip invite" style={{ width: '100%', height: '100%' }} /> : <Loader2 size={20} style={{ color: '#6b7280' }} className="spin" />}
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Point a phone camera at the code — it opens the trip, even without the app.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', minWidth: 0 }}>
            <LinkIcon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span id="trip-invite-link" style={{ fontSize: 11.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{link}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <Action onClick={() => copy('link', link)} Icon={copied === 'link' ? Check : Copy}>{copied === 'link' ? 'Copied' : 'Copy link'}</Action>
        {canShare && <Action onClick={share} Icon={Send} primary>WhatsApp, contacts…</Action>}
        <Action onClick={() => setEmailOpen((o) => !o)} Icon={Mail}>Email</Action>
        <Action onClick={() => copy('msg', inviteMessage(trip, link))} Icon={copied === 'msg' ? Check : Copy}>{copied === 'msg' ? 'Copied' : 'Copy message'}</Action>
      </div>

      {emailOpen && (
        <form id="trip-invite-email" onSubmit={sendEmail} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>We’ll email them an invite to “{trip.name}” with a Join button — they sign in or create a free account and pick their name.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="trip-invite-to" type="email" multiple value={to} onChange={(e) => setTo(e.target.value)} placeholder="friend@example.com" autoComplete="email" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
            <PrimaryButton type="submit" color="var(--external)"><Send size={14} /> Send</PrimaryButton>
          </div>
          {mailError && <div style={{ fontSize: 12, color: 'var(--expense)' }}>{mailError}</div>}
          {sent.length > 0 && <div id="trip-invite-sent" style={{ fontSize: 12, color: 'var(--income)', lineHeight: 1.5 }}><Check size={12} style={{ verticalAlign: -2 }} /> Invite on its way to {sent.join(', ')} — it usually arrives within a few minutes.</div>}
          <a href={inviteMailto(trip, link)} style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Or send it from your own email app</a>
        </form>
      )}

      {addable.length > 0 && (
        <div>
          <div style={sectionLabel}>Friends from your trips</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {addable.map((f) => <FriendRow key={f.uid} friend={f} trip={trip} openSlots={openSlots} onLinkFriend={onLinkFriend} />)}
          </div>
        </div>
      )}

      <div>
        <div style={sectionLabel}>On this trip · {joined.size} of {members.length} joined</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.map((m) => {
            const uid = Object.keys(trip.uidMember ?? {}).find((u) => trip.uidMember[u] === m.id);
            const p = uid ? trip.people?.[uid] : null;
            return (
              <span key={m.id} className="trip-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: p ? '3px 10px 3px 3px' : '5px 10px', fontSize: 12, fontWeight: 650, border: '1px solid var(--border)', background: p ? 'var(--income-bg, var(--surface2))' : 'var(--surface2)', color: 'var(--text)' }}>
                {p && <Avatar user={{ displayName: p.name, photoURL: p.photo }} size={20} />}
                {m.name}
                {p ? <UserCheck size={12} style={{ color: 'var(--income)' }} /> : <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· waiting</span>}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Someone not on the list yet? They can join as a new person — or add their name in the People box first.
        </div>
      </div>
    </ModalShell>
  );
}

function FriendRow({ friend, trip, openSlots, onLinkFriend }) {
  // Match a person on the trip with the same first name, if there is one
  const guess = openSlots.find((m) => m.name.trim().toLowerCase() === friend.name.trim().split(/\s+/)[0].toLowerCase())?.id ?? '';
  const [slot, setSlot] = useState(guess || 'new');
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    const members = trip.members ?? [];
    let memberId = slot, next = members;
    if (slot === 'new') { memberId = generateId(); next = [...members, { id: memberId, name: friend.name.split(/\s+/)[0] }]; }
    try { await onLinkFriend(trip, friend, memberId, next); } finally { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
      <Avatar user={{ displayName: friend.name, photoURL: friend.photo }} size={28} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 650, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.name}</span>
      <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label={`Add ${friend.name} as`} style={{ ...fieldStyle, width: 'auto', maxWidth: 140, padding: '6px 8px', fontSize: 12 }}>
        {openSlots.map((m) => <option key={m.id} value={m.id}>as {m.name}</option>)}
        <option value="new">as a new person</option>
      </select>
      <button onClick={add} disabled={busy} style={{ height: 30, padding: '0 10px', borderRadius: 9, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
        {busy ? <Loader2 size={12} className="spin" /> : <UserPlus size={12} />} Add
      </button>
    </div>
  );
}

const sectionLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' };

function Action({ children, onClick, href, Icon, primary }) {
  const style = {
    padding: '10px 12px', borderRadius: 11, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: primary ? 'var(--external)' : 'var(--surface2)', color: primary ? '#fff' : 'var(--text)',
    border: primary ? 'none' : '1px solid var(--border)',
  };
  return href
    ? <a href={href} style={style}><Icon size={14} /> {children}</a>
    : <button type="button" onClick={onClick} style={style}><Icon size={14} /> {children}</button>;
}
