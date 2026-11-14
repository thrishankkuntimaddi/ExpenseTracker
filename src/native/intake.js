// ─── Android: shares, widget taps, reading pictures, widgets ─────
// Only in an APK that has these plugins (3.28 and later). Older installed
// apps keep updating over the air and simply don't show these features.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { platform } from './index';

const Intake = registerPlugin('Intake');
const Widgets = registerPlugin('Widgets');
const has = (name) => platform === 'android' && Capacitor.isPluginAvailable(name);

export const intakeAvailable = () => has('Intake');
export const widgetsAvailable = () => has('Widgets');

/** "Share → Expense Tracker": { text, image, error? } */
export function onShared(cb) {
  if (!intakeAvailable()) return () => {};
  const h = Intake.addListener('shared', cb);
  return () => { h.then((x) => x.remove()); };
}

/** A widget tap: expensetracker://add/expense, …/page/bills → { kind: 'add'|'page', target } */
export function onWidgetAction(cb) {
  if (!intakeAvailable()) return () => {};
  const h = Intake.addListener('action', ({ url }) => {
    const m = String(url ?? '').match(/^expensetracker:\/\/(add|page)\/([a-z]+)/i);
    if (m) cb({ kind: m[1].toLowerCase(), target: m[2].toLowerCase() });
  });
  return () => { h.then((x) => x.remove()); };
}

/** Read the text in a picture on the phone (ML Kit). Resolves '' when it can't. */
export async function readPicture(dataUrl) {
  if (!intakeAvailable()) return '';
  try { return (await Intake.recognize({ base64: dataUrl })).text ?? ''; } catch { return ''; }
}

let pending = null, timer = null;
const flush = () => {
  clearTimeout(timer); timer = null;
  if (pending) { const d = pending; pending = null; Widgets.update({ data: d }).catch(() => {}); }
};
/** Hand the latest summary to the widgets (debounced; sent at once when the app goes to the background). */
export function pushWidgets(data) {
  if (!widgetsAvailable()) return;
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
}
// Add an entry and go straight to the home screen: Android pauses the app
// before the debounce fires — send what's waiting as the app is hidden.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pending) flush(); });
}
/** Signed out / account deleted: the widgets forget this account's figures. */
export async function clearWidgets() {
  if (!widgetsAvailable()) return;
  clearTimeout(timer); timer = null; pending = null;
  try { await Widgets.update({ data: {} }); } catch { /* an older app */ }
}

/** Entries typed on the home screen (quick-entry card): [{ id, kind, amount, name, at }]. */
export async function widgetQueue() {
  if (!widgetsAvailable()) return [];
  try { return (await Widgets.queue()).items ?? []; } catch { return []; }   // an older app has no queue
}
export async function clearWidgetQueue(ids) {
  if (!widgetsAvailable() || !ids.length) return;
  try { await Widgets.clearQueue({ ids }); } catch { /* stays queued; ids are stable, so nothing doubles */ }
}

export async function widgetCount() {
  if (!widgetsAvailable()) return 0;
  try { return (await Widgets.status()).placed ?? 0; } catch { return 0; }
}
