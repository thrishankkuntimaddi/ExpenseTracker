// ─── Help center (Profile → Help & support → Help) ───────────────
// One calm page instead of a long list of guides:
//   • search over the answers
//   • three ways to talk to us — Report a problem, Share an idea, Ask —
//     which reach the owner at once (Admin sees → Inbox, push and email)
//   • the tour, and a guide per page as a compact grid
//   • gestures (swipes) explained once, and short answers to common questions
import { useMemo, useState } from 'react';
import { PlayCircle, Search, Bug, Lightbulb, MessageCircleQuestion, ChevronDown, Send, Check, Hand, ArrowLeftRight, MoveLeft, MoveRight, X } from 'lucide-react';
import { startTour, GUIDE_PAGES } from '../../tour/tour';
import { PAGE_META } from '../../app/pages';
import { sendFeedback } from '../../services/feedback';
import { fieldStyle } from '../../components/formTokens';
import { t as tr } from '../../i18n';

const FAQ = [
  ['Is my money data private?', 'Yes. Only your account can read your entries — the database rules refuse everyone else, including the app’s owner. The owner sees only that you use the app (when, how many entries), never amounts or what they were for.'],
  ['How do I delete my account?', 'Profile → Account → Delete my account. Confirm it’s you, type DELETE, and everything goes: your entries, settings, shared trips you created and your sign-in. If something can’t finish on your phone, our server completes it within the hour.'],
  ['Why only 3 devices?', 'To keep your account safe, it can be signed in on up to 3 devices at once. On a 4th, the app asks you to sign one of the others out first. Profile → Privacy & security → Your devices shows them all.'],
  ['How do I join a friend’s trip?', 'Open the invite link they sent — if you have the app it opens straight in the app — then pick your name on the trip. Or Trips → Join a trip and paste the link or code.'],
  ['Does it work offline?', 'Yes. Add entries anywhere; they upload when you’re back online. Profile → Your data → Sync shows if anything is waiting.'],
  ['How do backups work?', 'Your data is saved to your account in the cloud as you go. For your own copy, turn on Google Drive backup or export a file under Your data → Data management.'],
  ['Can I undo a delete?', 'Yes — deleted entries wait in Recently Deleted (Your data → Data management) until you empty it.'],
  ['How do recurring entries work?', 'Plan → Recurring: add rent, SIP, salary or subscriptions once. They either log themselves on the day, or ask you with a one-tap Log / Skip card.'],
];

const GESTURES = [
  [ArrowLeftRight, 'Swipe sideways on a page', 'Moves between the pages in your bottom bar.'],
  [MoveLeft, 'Swipe an entry to the left', 'Shows Edit and Delete. Swipe all the way to delete it (it goes to Recently Deleted).'],
  [MoveRight, 'Swipe an entry to the right', 'Opens it for editing.'],
  [Hand, 'Swipe inside the + window', 'Switches between Expense, Income, Debt and Savings.'],
];

const TALK = [
  { kind: 'bug', label: 'Report a problem', hint: 'Something broke or looks wrong', Icon: Bug, tone: 'expense', placeholder: 'What happened, and what did you expect? Which page were you on?' },
  { kind: 'idea', label: 'Share an idea', hint: 'What would make it better', Icon: Lightbulb, tone: 'accent', placeholder: 'I wish the app could…' },
  { kind: 'question', label: 'Ask a question', hint: 'We reply by email', Icon: MessageCircleQuestion, tone: 'savings', placeholder: 'Your question' },
];

export default function HelpCenter() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [writing, setWriting] = useState(null);
  const query = q.trim().toLowerCase();
  const faqs = useMemo(() => FAQ.filter(([a, b]) => !query || `${a} ${b}`.toLowerCase().includes(query)), [query]);
  const guides = GUIDE_PAGES().filter((k) => !query || `${PAGE_META[k].label} ${PAGE_META[k].description}`.toLowerCase().includes(query));

  return (
    <div id="help-center" style={{ padding: '14px 16px 18px', display: 'grid', gap: 18 }}>
      {/* Search */}
      <label style={{ position: 'relative', display: 'block' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input id="help-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search help — “delete account”, “trip”, “backup”…')}
          style={{ ...fieldStyle, paddingLeft: 36, borderRadius: 14, fontSize: 14 }} />
      </label>

      {/* Talk to us */}
      {!query && (
        <section>
          <Label>{tr('Talk to us')}</Label>
          {writing
            ? <FeedbackForm talk={TALK.find((x) => x.kind === writing)} onClose={() => setWriting(null)} />
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {TALK.map(({ kind, label, hint, Icon, tone }) => (
                  <button key={kind} id={`help-talk-${kind}`} type="button" onClick={() => setWriting(kind)} className="help-tile"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 12, minHeight: 104, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: `var(--${tone}-bg)`, color: `var(--${tone})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></span>
                    <span style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--text)', lineHeight: 1.25 }}>{tr(label)}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 'auto' }}>{tr(hint)}</span>
                  </button>
                ))}
              </div>
            )}
        </section>
      )}

      {/* Tour + guides */}
      {(!query || guides.length > 0) && (
        <section>
          <Label>{tr('Learn the app')}</Label>
          {!query && (
            <button id="help-start-tour" type="button" onClick={() => startTour('app')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: 'none', borderRadius: 16, background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', marginBottom: 10 }}>
              <PlayCircle size={22} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 750 }}>{tr('Take the app tour')}</span>
                <span style={{ display: 'block', fontSize: 11.5, opacity: 0.85 }}>{tr('About a minute — the best place to start')}</span>
              </span>
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
            {guides.map((k) => {
              const { label, Icon, tone } = PAGE_META[k];
              return (
                <button key={k} id={`help-guide-${k}`} type="button" onClick={() => startTour(k)} title={PAGE_META[k].description}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: `var(--${tone}-bg)`, color: `var(--${tone})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
                </button>
              );
            })}
          </div>
          {!query && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 2px 0' }}>{tr('The ? at the top of any page opens its guide too.')}</p>}
        </section>
      )}

      {/* Gestures */}
      {!query && (
        <section>
          <Label>{tr('Swipes & gestures')}</Label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {GESTURES.map(([Icon, title, text], i) => (
              <div key={title} style={{ display: 'flex', gap: 12, padding: '11px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <Icon size={17} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tr(title)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 1 }}>{tr(text)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section>
        <Label>{query ? tr('Answers') : tr('Common questions')}</Label>
        {faqs.length === 0 && guides.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {tr('Nothing about that yet.')}{' '}
            <button type="button" onClick={() => { setQ(''); setWriting('question'); }} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--accent)', fontWeight: 700, fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer' }}>{tr('Ask us')}</button>
          </div>
        )}
        <div style={{ border: faqs.length ? '1px solid var(--border)' : 'none', borderRadius: 16, overflow: 'hidden' }}>
          {faqs.map(([qq, a], i) => {
            const on = open === qq || !!query;
            return (
              <div key={qq} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <button type="button" onClick={() => setOpen(on && !query ? null : qq)} aria-expanded={on}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tr(qq)}</span>
                  <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                </button>
                {on && <p style={{ margin: 0, padding: '0 12px 12px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{tr(a)}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Label({ children }) {
  return <p className="section-label" style={{ margin: '0 2px 8px' }}>{children}</p>;
}

function FeedbackForm({ talk, onClose }) {
  const [text, setText] = useState('');
  const [state, setState] = useState('idle');   // idle | sending | sent | error
  const [err, setErr] = useState('');
  async function send(e) {
    e.preventDefault();
    setState('sending');
    try { await sendFeedback({ kind: talk.kind, text, page: 'help' }); setState('sent'); }
    catch (x) { setErr(x?.message ?? 'Couldn’t send — check your connection.'); setState('error'); }
  }
  if (state === 'sent') {
    return (
      <div id="help-sent" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, background: 'var(--income-bg)' }}>
        <Check size={20} style={{ color: 'var(--income)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text)' }}>{tr('Thanks — it’s with us')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{tr('We read every one. If you asked something, the answer comes to your email.')}</div>
        </div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{tr('Done')}</button>
      </div>
    );
  }
  return (
    <form id="help-feedback" onSubmit={send} style={{ padding: 12, borderRadius: 16, border: `1.5px solid var(--${talk.tone}-border, var(--border))`, background: 'var(--surface)', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <talk.Icon size={16} style={{ color: `var(--${talk.tone})` }} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 750, color: 'var(--text)' }}>{tr(talk.label)}</span>
        <button type="button" aria-label={tr('Close')} onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
      </div>
      <textarea id="help-feedback-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={5} autoFocus placeholder={tr(talk.placeholder)}
        style={{ ...fieldStyle, resize: 'vertical', minHeight: 110, lineHeight: 1.5, fontFamily: 'inherit' }} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>{tr('Sent with your name, email, app version and device type — never your entries or amounts.')}</div>
      {state === 'error' && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: 'var(--expense)' }}>{err}</div>}
      <button type="submit" disabled={!text.trim() || state === 'sending'}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 14px', borderRadius: 12, border: 'none', background: text.trim() ? `var(--${talk.tone})` : 'var(--surface2)', color: text.trim() ? '#fff' : 'var(--text-muted)', fontSize: 13, fontWeight: 750, fontFamily: 'inherit', cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
        <Send size={14} /> {state === 'sending' ? tr('Sending…') : tr('Send')}
      </button>
    </form>
  );
}
