// ─── Category picker / badge ──────────────────────────────────────
// Horizontal chip row used by every expense form. The suggested (inferred)
// category is marked with a ✦ so the user sees what auto-tagging chose and
// can override it with one tap.
import { CircleDashed } from 'lucide-react';
import { CATEGORIES, categoryMeta, categoryColor } from '../utils/categories';
import { CATEGORY_ICONS } from './categoryIcons';
import { currentTheme } from '../utils/theme';

export function CategoryIcon({ category, size = 12, style }) {
  const Icon = CATEGORY_ICONS[categoryMeta(category).icon] ?? CircleDashed;
  return <Icon size={size} style={style} />;
}

export function CategoryBadge({ category, compact = false, theme }) {
  if (!category) return null;
  const color = categoryColor(category, theme ?? currentTheme());
  const meta = categoryMeta(category);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: compact ? 10 : 11, fontWeight: 600, color,
      background: color + '1A', border: `1px solid ${color}44`,
      padding: compact ? '1px 6px' : '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <CategoryIcon category={category} size={compact ? 9 : 11} />
      {meta.label}
    </span>
  );
}

export default function CategoryPicker({ value, suggested, onChange, size = 'md', theme, label = 'Category' }) {
  const t = theme ?? currentTheme();
  const small = size === 'sm';
  // Suggested first, then the rest in their natural order
  const ordered = suggested
    ? [CATEGORIES.find((c) => c.key === suggested), ...CATEGORIES.filter((c) => c.key !== suggested)]
    : CATEGORIES;
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
          {suggested && value !== suggested && (
            <button type="button" onClick={() => onChange(suggested)} style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}>
              ✦ Use suggestion: {categoryMeta(suggested).label}
            </button>
          )}
        </div>
      )}
      <div className="cat-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {ordered.map((c) => {
          const active = value === c.key;
          const color = categoryColor(c.key, t);
          const Icon = CATEGORY_ICONS[c.icon] ?? CircleDashed;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(c.key)}
              title={c.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: small ? '4px 9px' : '6px 11px', borderRadius: 20,
                fontSize: small ? 10 : 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                border: `1.5px solid ${active ? color : 'var(--border)'}`,
                background: active ? color + '22' : 'transparent',
                color: active ? color : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={small ? 10 : 12} />
              {c.label}
              {suggested === c.key && <span style={{ fontSize: 9, opacity: 0.8 }}>✦</span>}
            </button>
          );
        })}
      </div>
      <style>{`.cat-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
