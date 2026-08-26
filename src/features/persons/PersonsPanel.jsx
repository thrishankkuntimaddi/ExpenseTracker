// ─── PersonsPanel ──────────────────────────────────────────────────
// Aggregated list of all people from person transactions.
// Clicking a person opens their PersonLedger.

import { useState, useMemo } from 'react';
import { Users, Search, TrendingDown, TrendingUp, ChevronRight, UserPlus } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import PersonLedger from './PersonLedger';

/* ─── Person Card ─── */
function PersonCard({ person, onClick }) {
  const isOwed      = person.outstanding > 0;  // They owe me money
  const isDebt      = person.outstanding < 0;  // I owe them money
  const isSettled   = person.outstanding === 0;
  const absAmount   = Math.abs(person.outstanding);

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
          background: isDebt ? '#EFF6FF' : 'var(--person-bg)',
          border: `1.5px solid ${isDebt ? '#93C5FD' : 'var(--person-border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: isDebt ? '#2563EB' : 'var(--person)',
        }}>
          {person.name.trim()[0]?.toUpperCase() ?? '?'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {person.txnCount} transaction{person.txnCount !== 1 ? 's' : ''}
            {isSettled ? ' · Settled' : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: isSettled ? 'var(--text-muted)' : isOwed ? 'var(--expense)' : 'var(--income)',
          }}>
            {isSettled ? '₹0' : (isDebt ? '-' : '+') + formatAmount(absAmount)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {isSettled ? 'settled' : isOwed ? 'owes you' : 'you owe them'}
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

  // Aggregate all person transactions by normalized name across all 4 directions
  const persons = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.type === 'person')
      .forEach(t => {
        const key = t.name?.trim().toLowerCase() ?? 'unknown';
        const displayName = t.name?.trim() ?? 'Unknown';
        if (!map[key]) {
          map[key] = {
            name: displayName, txnCount: 0,
            totalLent: 0, totalRepaid: 0,
            totalBorrowed: 0, totalRepaidThem: 0,
            outstanding: 0
          };
        }
        map[key].txnCount++;
        const dir = t.direction ?? 'lent';
        const amt = t.amount ?? 0;

        if (dir === 'lent') {
          map[key].totalLent += amt;
        } else if (dir === 'repayment') {
          map[key].totalRepaid += amt;
        } else if (dir === 'borrowed') {
          map[key].totalBorrowed += amt;
        } else if (dir === 'repaid') {
          map[key].totalRepaidThem += amt;
        }

        // Net outstanding: positive = they owe me, negative = I owe them
        map[key].outstanding = (map[key].totalLent - map[key].totalRepaid) - (map[key].totalBorrowed - map[key].totalRepaidThem);
      });
    return Object.values(map).sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding));
  }, [transactions]);

  const filtered = useMemo(() =>
    persons.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [persons, search]
  );

  const totalOwedToMe = persons.filter(p => p.outstanding > 0).reduce((s, p) => s + p.outstanding, 0);
  const totalIOwe     = persons.filter(p => p.outstanding < 0).reduce((s, p) => s + Math.abs(p.outstanding), 0);
  const totalCount    = persons.length;

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
              Debt & lending ledger — track who owes you & who you owe
            </p>
          </div>
          {totalCount > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {totalOwedToMe > 0 && (
                <div style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'var(--person-bg)', color: 'var(--person)',
                  border: '1.5px solid var(--person-border)',
                }}>
                  {formatAmount(totalOwedToMe)} owed to you
                </div>
              )}
              {totalIOwe > 0 && (
                <div style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: '#EFF6FF', color: '#2563EB',
                  border: '1.5px solid #93C5FD',
                }}>
                  {formatAmount(totalIOwe)} you owe
                </div>
              )}
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
