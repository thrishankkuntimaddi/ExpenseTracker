// Month carry forward: roll each month's leftover into the next as income.
import { ArrowRightLeft } from 'lucide-react';
import { Group } from './SettingsGroup';
import { getCarrySettings } from '../../utils/carryForward';
import { formatMonthLabel } from '../../utils/periodHelpers';
import { t as tr } from '../../i18n';

export default function CarryForwardGroup({ settings, onPatchSettings }) {
  const carry = getCarrySettings(settings);
  const setCarry = (patch) => onPatchSettings?.({ carryForward: { ...carry, ...patch } });
  return (
      <Group id="month-carry-forward" color="var(--repayment-rec)" title={tr("Month Carry Forward")} Icon={ArrowRightLeft} summary={carry.enabled ? tr("On") : tr("Off")}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowRightLeft size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tr("Roll leftover into next month")}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {carry.enabled
                  ? `From ${formatMonthLabel(carry.startMonth)}: each month's remaining balance appears as income in the next`
                  : tr("Off — every month starts from zero")}
              </div>
            </div>
          </div>
          <button className={`toggle-track ${carry.enabled ? 'on' : ''}`} onClick={() => setCarry({ enabled: !carry.enabled })} aria-label={tr("Toggle carry forward")}>
            <span className="toggle-thumb" />
          </button>
        </div>
        {carry.enabled && (
          <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span>{tr("First month that receives a carry")}</span>
              <input
                id="settings-carry-start"
                type="month"
                value={carry.startMonth}
                onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setCarry({ startMonth: e.target.value }); }}
                style={{ padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
              <span>{tr("Also carry a deficit (negative leftover)")}</span>
              <input type="checkbox" checked={!!carry.includeNegative} onChange={e => setCarry({ includeNegative: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            </label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {tr("The carried amount is computed live from the previous month, so a late edit to")} {formatMonthLabel(carry.startMonth === '2026-11' ? '2026-10' : carry.startMonth)} {tr("updates it automatically. It is shown as an")} <strong>{tr("auto")}</strong> {tr("line on the Income tab and counted in that month's income and balance.")}
            </div>
          </div>
        )}
      </Group>
  );
}
