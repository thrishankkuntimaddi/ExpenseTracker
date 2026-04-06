import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  getCurrentMonthValue, getDefaultPeriod, getPeriodLabel,
  getAvailableMonths, getAvailableYears, formatMonthLabel,
} from '../utils/periodHelpers';

const PERIOD_TYPES = [
  { value: 'current_month',  label: 'Current Month' },
  { value: 'select_month',   label: 'Select Month'  },
  { value: 'year',           label: 'Year View'     },
  { value: 'last_3_months',  label: 'Last 3 Months' },
  { value: 'custom_range',   label: 'Custom Range'  },
];

const selectBase = {
  padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
  border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A',
  outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
};

const inputDate = {
  padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
  border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A',
  outline: 'none', fontFamily: 'inherit',
};

export default function PeriodSelector({ period, onChange, transactions = [], income = [], compact = false }) {
  const months = getAvailableMonths(transactions, income);
  const years  = getAvailableYears(transactions, income);
  const today  = new Date().toISOString().slice(0, 10);
  const label  = getPeriodLabel(period);

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

      {/* Period badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 20,
        background: '#EFF6FF', border: '1.5px solid #BFDBFE',
        fontSize: 12, fontWeight: 700, color: '#2563EB',
        flexShrink: 0,
      }}>
        📅 {label}
      </div>

      {/* Type selector */}
      <div style={{ position: 'relative' }}>
        <select value={period.type} onChange={e => handleTypeChange(e.target.value)} style={selectBase}>
          {PERIOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }} />
      </div>

      {/* Month picker */}
      {period.type === 'select_month' && (
        <div style={{ position: 'relative' }}>
          <select value={period.value} onChange={e => onChange({ ...period, value: e.target.value })} style={selectBase}>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Year picker */}
      {period.type === 'year' && (
        <div style={{ position: 'relative' }}>
          <select value={period.value} onChange={e => onChange({ ...period, value: e.target.value })} style={selectBase}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Custom range */}
      {period.type === 'custom_range' && (
        <>
          <input
            type="date"
            value={period.start || ''}
            max={period.end || today}
            onChange={e => onChange({ ...period, start: e.target.value })}
            style={inputDate}
          />
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>to</span>
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
            style={inputDate}
          />
        </>
      )}
    </div>
  );
}
