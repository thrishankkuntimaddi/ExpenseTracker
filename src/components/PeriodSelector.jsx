import { ChevronDown, Calendar } from 'lucide-react';
import {
  getCurrentMonthValue, getAvailableMonths, getAvailableYears, formatMonthLabel,
} from '../utils/periodHelpers';

const PERIOD_TYPES = [
  { value: 'current_month',  label: 'This Month'    },
  { value: 'select_month',   label: 'Select Month'  },
  { value: 'year',           label: 'Year View'     },
  { value: 'last_3_months',  label: 'Last 3 Months' },
  { value: 'custom_range',   label: 'Custom Range'  },
];

const selectStyle = {
  padding: '6px 26px 6px 12px',
  borderRadius: 10, fontSize: 12, fontWeight: 600,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
  transition: 'all 0.15s ease',
};

const dateInputStyle = {
  padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit',
  colorScheme: 'dark light',
};

export default function PeriodSelector({ period, onChange, transactions = [], income = [] }) {
  const months = getAvailableMonths(transactions, income);
  const years  = getAvailableYears(transactions, income);
  const today  = new Date().toISOString().slice(0, 10);

  function handleTypeChange(type) {
    switch (type) {
      case 'current_month':
        onChange({ type, value: getCurrentMonthValue() }); break;
      case 'select_month':
        onChange({ type, value: months[0] || getCurrentMonthValue() }); break;
      case 'year':
        onChange({ type, value: years[0] || String(new Date().getFullYear()) }); break;
      case 'last_3_months':
        onChange({ type }); break;
      case 'custom_range': {
        const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
        const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
        onChange({ type, start: monthStart, end: today });
        break;
      }
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Type selector */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Calendar size={13} style={{ position: 'absolute', left: 10, color: 'var(--accent)', pointerEvents: 'none' }} />
        <select
          value={period.type}
          onChange={e => handleTypeChange(e.target.value)}
          style={{ ...selectStyle, paddingLeft: 30 }}
        >
          {PERIOD_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <ChevronDown size={12} style={{
          position: 'absolute', right: 8, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }} />
      </div>

      {/* Month picker */}
      {period.type === 'select_month' && (
        <div style={{ position: 'relative' }}>
          <select
            value={period.value}
            onChange={e => onChange({ ...period, value: e.target.value })}
            style={selectStyle}
          >
            {months.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <ChevronDown size={12} style={{
            position: 'absolute', right: 8, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
        </div>
      )}

      {/* Year picker */}
      {period.type === 'year' && (
        <div style={{ position: 'relative' }}>
          <select
            value={period.value}
            onChange={e => onChange({ ...period, value: e.target.value })}
            style={selectStyle}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={12} style={{
            position: 'absolute', right: 8, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
        </div>
      )}

      {/* Custom date range */}
      {period.type === 'custom_range' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="date"
            value={period.start || ''}
            max={period.end || today}
            onChange={e => onChange({ ...period, start: e.target.value })}
            style={dateInputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>→</span>
          <input
            type="date"
            value={period.end || ''}
            min={period.start || ''}
            max={today}
            onChange={e => {
              if (e.target.value >= (period.start || '')) {
                onChange({ ...period, end: e.target.value });
              }
            }}
            style={dateInputStyle}
          />
        </div>
      )}
    </div>
  );
}
