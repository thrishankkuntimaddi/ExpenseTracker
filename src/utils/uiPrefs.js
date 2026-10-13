// ─── UI preferences (phone layout) ───────────────────────────────
// What the user customised in Profile → Customize: the four pages in the
// bottom bar, the page the app opens on, and the order / visibility of the
// Home sections. Stored in settings.ui so every device follows it.
// Anything unknown, duplicated or missing is repaired here, so an old or
// hand-edited value can never leave the app without a way to a page.

export const PAGE_KEYS = ['today', 'history', 'income', 'stats', 'plan', 'external'];
export const BAR_SLOTS = 4;
export const DEFAULT_TABS = ['today', 'history', 'income', 'stats'];

export const HOME_SECTIONS = [
  { key: 'overview', label: 'Month overview', hint: 'Spent, today, budget left and safe to spend' },
  { key: 'due',      label: 'Recurring due',  hint: 'Rent, SIPs and bills waiting to be logged' },
  { key: 'add',      label: 'Quick add',      hint: 'The entry form — always shown', locked: true },
  { key: 'recent',   label: 'Recent entries', hint: 'Your last seven days' },
];
const HOME_KEYS = HOME_SECTIONS.map((s) => s.key);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** settings.ui (any shape) → { tabs[4], start, home: [{ key, visible }] } */
export function normaliseUi(raw) {
  const r = isObj(raw) ? raw : {};

  const tabs = [];
  for (const k of Array.isArray(r.tabs) ? r.tabs : []) {
    if (PAGE_KEYS.includes(k) && !tabs.includes(k) && tabs.length < BAR_SLOTS) tabs.push(k);
  }
  for (const k of [...DEFAULT_TABS, ...PAGE_KEYS]) {
    if (tabs.length >= BAR_SLOTS) break;
    if (!tabs.includes(k)) tabs.push(k);
  }

  const start = PAGE_KEYS.includes(r.start) ? r.start : 'today';

  const hidden = new Set(Array.isArray(r.homeHidden) ? r.homeHidden.filter((k) => HOME_KEYS.includes(k)) : []);
  const order = [];
  for (const k of Array.isArray(r.homeOrder) ? r.homeOrder : []) {
    if (HOME_KEYS.includes(k) && !order.includes(k)) order.push(k);
  }
  for (const k of HOME_KEYS) if (!order.includes(k)) order.push(k);
  const home = order.map((key) => ({
    key,
    visible: HOME_SECTIONS.find((s) => s.key === key).locked ? true : !hidden.has(key),
  }));

  return { tabs, start, home };
}

/** The normalised prefs → the compact shape saved in settings.ui. */
export function serialiseUi({ tabs, start, home }) {
  return {
    tabs: [...tabs],
    start,
    homeOrder: home.map((s) => s.key),
    homeHidden: home.filter((s) => !s.visible).map((s) => s.key),
  };
}

/** Move item `i` of a list by `delta` places (clamped); returns a new array. */
export function move(list, i, delta) {
  const j = Math.max(0, Math.min(list.length - 1, i + delta));
  if (i === j || i < 0 || i >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

/** Replace the page in bar slot `i` with `key` (swapping if it's already elsewhere in the bar). */
export function setTabAt(tabs, i, key) {
  if (!PAGE_KEYS.includes(key) || i < 0 || i >= tabs.length) return tabs;
  const next = [...tabs];
  const at = next.indexOf(key);
  if (at === i) return tabs;
  if (at >= 0) next[at] = next[i];
  next[i] = key;
  return next;
}
