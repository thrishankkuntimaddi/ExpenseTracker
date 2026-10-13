// ─── UI preferences (phone layout) ───────────────────────────────
// What the user customised in Profile → Customize: the three pages beside
// Home and "+" in the bottom bar, the page the app opens on, and the order /
// visibility of the Home sections. Stored in settings.ui so every device
// follows it.
// Anything unknown, duplicated or missing is repaired here, so an old or
// hand-edited value can never leave the app without a way to a page.

/* Every phone page. Home ('today') is always the first bar item; the bar's
   other slots take any of SLOT_KEYS. */
export const PAGE_KEYS = ['today', 'history', 'bills', 'stats', 'budget', 'savings', 'income', 'people', 'trips', 'external'];
export const SLOT_KEYS = PAGE_KEYS.filter((k) => k !== 'today');
export const BAR_SLOTS = 3;
export const DEFAULT_TABS = ['history', 'bills', 'stats'];
/* Pages from earlier versions → where they live now */
const LEGACY_PAGE = { plan: 'bills' };
const LEGACY_SECTION = { due: 'bills', actions: 'explore' };

export const HOME_SECTIONS = [
  { key: 'overview', label: 'Month overview',  hint: 'Spent, budget, today, safe to spend, balance' },
  { key: 'add',      label: 'Quick entry',     hint: 'Type “chai 20” and press enter' },
  { key: 'bills',    label: 'Bills due',       hint: 'Shows up only when a payment is due or late' },
  { key: 'explore',  label: 'Explore',         hint: 'Every page that isn’t in your bar', locked: true },
  { key: 'recent',   label: 'Recent activity', hint: 'Your last seven days' },
];
const HOME_KEYS = HOME_SECTIONS.map((s) => s.key);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** settings.ui (any shape) → { tabs[3], start, home: [{ key, visible }] } */
export function normaliseUi(raw) {
  const r = isObj(raw) ? raw : {};

  const tabs = [];
  for (const raw of Array.isArray(r.tabs) ? r.tabs : []) {
    const k = LEGACY_PAGE[raw] ?? raw;
    if (SLOT_KEYS.includes(k) && !tabs.includes(k) && tabs.length < BAR_SLOTS) tabs.push(k);
  }
  for (const k of [...DEFAULT_TABS, ...SLOT_KEYS]) {
    if (tabs.length >= BAR_SLOTS) break;
    if (!tabs.includes(k)) tabs.push(k);
  }

  const startKey = LEGACY_PAGE[r.start] ?? r.start;
  const start = PAGE_KEYS.includes(startKey) ? startKey : 'today';

  const section = (k) => LEGACY_SECTION[k] ?? k;
  const hidden = new Set(Array.isArray(r.homeHidden) ? r.homeHidden.map(section).filter((k) => HOME_KEYS.includes(k)) : []);
  const order = [];
  for (const raw of Array.isArray(r.homeOrder) ? r.homeOrder : []) {
    const k = section(raw);
    if (HOME_KEYS.includes(k) && !order.includes(k)) order.push(k);
  }
  // Sections the saved order doesn't know yet (added in a later version)
  // go in after their default neighbour, not at the very end.
  HOME_KEYS.forEach((k, i) => {
    if (order.includes(k)) return;
    const prev = HOME_KEYS.slice(0, i).reverse().find((p) => order.includes(p));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, k);
  });
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
  if (!SLOT_KEYS.includes(key) || i < 0 || i >= tabs.length) return tabs;
  const next = [...tabs];
  const at = next.indexOf(key);
  if (at === i) return tabs;
  if (at >= 0) next[at] = next[i];
  next[i] = key;
  return next;
}
