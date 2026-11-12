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
/** Hand the latest summary to the widgets (debounced). */
export function pushWidgets(data) {
  if (!widgetsAvailable()) return;
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(() => { Widgets.update({ data: pending }).catch(() => {}); }, 800);
}

export async function widgetCount() {
  if (!widgetsAvailable()) return 0;
  try { return (await Widgets.status()).placed ?? 0; } catch { return 0; }
}
