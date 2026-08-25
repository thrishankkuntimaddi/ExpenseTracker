// ─── Date Helpers ────────────────────────────────────────────────

export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatAmount(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n ?? 0);
}

/** Returns today as a YYYY-MM-DD string for use in <input type="date"> */
export function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convert a YYYY-MM-DD date input value to an ISO string (start of that day, local time) */
export function dateInputToISO(dateStr) {
  if (!dateStr) return new Date().toISOString();
  // Use local midnight so the date isn't shifted by UTC offset
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString(); // noon local time avoids timezone edge cases
}

/** Convert an ISO string to a YYYY-MM-DD string for an <input type="date"> */
export function isoToDateInput(isoString) {
  if (!isoString) return todayInputValue();
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Derive the YYYY-MM month string from an ISO date string */
export function isoToMonth(isoString) {
  if (!isoString) return new Date().toISOString().slice(0, 7);
  return isoString.slice(0, 7);
}

export function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function groupByDay(items) {
  const map = {};
  items.forEach(item => {
    const key = new Date(item.date).toDateString();
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([key, entries]) => ({
      label: formatDate(new Date(key).toISOString()),
      entries,
    }));
}

export function groupByWeek(items) {
  const map = {};
  items.forEach(item => {
    const ws = getWeekStart(item.date);
    const key = ws.toDateString();
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([key, entries]) => ({
      label: `Week of ${formatDate(new Date(key).toISOString())}`,
      entries,
    }));
}

export function groupByMonth(items) {
  const map = {};
  items.forEach(item => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map)
    .sort((a, b) => {
      const [ay, am] = a[0].split('-').map(Number);
      const [by, bm] = b[0].split('-').map(Number);
      return by !== ay ? by - ay : bm - am;
    })
    .map(([key, entries]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return { label, entries };
    });
}
