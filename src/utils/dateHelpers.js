// ─── Date Helpers ────────────────────────────────────────────────

export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatAmount(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
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

