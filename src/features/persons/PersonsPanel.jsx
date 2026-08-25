// ─── PersonsPanel ──────────────────────────────────────────────────
// Aggregated list of all people from person transactions.
// Clicking a person opens their PersonLedger.

import { useState, useMemo } from 'react';
import { Users, Search, TrendingDown, TrendingUp, ChevronRight, UserPlus } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import PersonLedger from './PersonLedger';

/* ─── Person Card ─── */
function PersonCard({ person, onClick }) {
  const isOwed      = person.outstanding >= 0; // I am owed money (or settled)
  const outstanding = Math.abs(person.outstanding);

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 14,
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all 0.15s', boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--person-border)'; e.currentTarget.style.background = 'var(--person-bg)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'var(--person-bg)', border: '1.5px solid var(--person-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: 'var(--person)',
        }}>
          {person.name.trim()[0]?.toUpperCase() ?? '?'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {person.txnCount} transaction{person.txnCount !== 1 ? 's' : ''}
            {person.outstanding === 0 ? ' · Settled' : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: outstanding === 0 ? 'var(--text-muted)' : isOwed ? 'var(--expense)' : 'var(--income)',
          }}>
            {outstanding === 0 ? '₹0' : (isOwed ? '' : '+') + formatAmount(outstanding)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {outstanding === 0 ? 'settled' : isOwed ? 'outstanding' : 'owe them'}
          </div>
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
      </div>
    </button>
  );
}

/* ═══ PersonsPanel ═══ */
export default function PersonsPanel({ transactions, onAddTransaction, onUpdateTransaction, onDeleteTransaction }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [search, setSearch]                 = useState('');

  // Aggregate all person transactions by normalized name
  const persons = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.type === 'person')
      .forEach(t => {
        const key = t.name?.trim().toLowerCase() ?? 'unknown';
        const displayName = t.name?.trim() ?? 'Unknown';
        if (!map[key]) {
          map[key] = { name: displayName, txnCount: 0, totalLent: 0, totalRepaid: 0, outstanding: 0 };
        }
        map[key].txnCount++;
        if (t.direction === 'repayment') {
          map[key].totalRepaid += (t.amount ?? 0);
        } else {
          map[key].totalLent += (t.amount ?? 0);
        }
        map[key].outstanding = map[key].totalLent - map[key].totalRepaid;
      });
    return Object.values(map).sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding));
  }, [transactions]);

  const filtered = useMemo(() =>
    persons.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [persons, search]
  );

  const totalOutstanding = persons.reduce((s, p) => s + Math.max(0, p.outstanding), 0);
  const totalCount       = persons.length;

  // Show ledger for a selected person
  if (selectedPerson) {
    return (
      <PersonLedger
        personName={selectedPerson}
        transactions={transactions}
        onAddTransaction={onAddTransaction}
        onUpdateTransaction={onUpdateTransaction}
        onDeleteTransaction={onDeleteTransaction}
        onBack={() => setSelectedPerson(null)}
      />
    );
  }

  return (
    <div className="tab-root">
      {/* Header */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              People
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Debt ledger — who owes you what
            </p>
          </div>
          {totalCount > 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: 'var(--person-bg)', color: 'var(--person)',
              border: '1.5px solid var(--person-border)',
            }}>
              {formatAmount(totalOutstanding)} outstanding
            </div>
          )}
        </div>

        {/* Search */}
        {persons.length > 3 && (
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text" placeholder="Search people…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                borderRadius: 10, fontSize: 13, border: '1.5px solid var(--border)',
                background: 'var(--input-bg)', color: 'var(--text)',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px' }}>
        {persons.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22,
              background: 'var(--person-bg)', border: '1.5px solid var(--person-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus size={30} style={{ color: 'var(--person)', opacity: 0.7 }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                No person transactions yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 280, lineHeight: 1.6 }}>
                Add a "Person" transaction in Quick Entry to start tracking who owes you money.
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No people match "{search}"</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(p => (
              <PersonCard key={p.name} person={p} onClick={() => setSelectedPerson(p.name)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
