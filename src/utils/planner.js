// ─── Planner: long-term money calculators ────────────────────────
// Retirement, FIRE, a child's education and a step-up SIP. The maths
// matches the usual Indian planning spreadsheets (Excel FV / PV / PMT,
// monthly compounding at NOMINAL(rate, 12) / 12, payments at the start of
// each month). Rates are fractions (0.12 = 12 %). Pure — unit-tested.

/* ── Excel-compatible primitives (sign convention: money paid out is negative) ── */
export function fv(rate, nper, pmt = 0, pv = 0, type = 0) {
  if (rate === 0) return -(pv + pmt * nper);
  const g = (1 + rate) ** nper;
  return -(pv * g + pmt * (1 + rate * type) * ((g - 1) / rate));
}
export function pv(rate, nper, pmt = 0, fvv = 0, type = 0) {
  if (rate === 0) return -(fvv + pmt * nper);
  const g = (1 + rate) ** nper;
  return -(fvv + pmt * (1 + rate * type) * ((g - 1) / rate)) / g;
}
export function pmt(rate, nper, pvv = 0, fvv = 0, type = 0) {
  if (nper <= 0) return 0;
  if (rate === 0) return -(pvv + fvv) / nper;
  const g = (1 + rate) ** nper;
  return -(rate * (fvv + pvv * g)) / ((1 + rate * type) * (g - 1));
}
/** Monthly rate equivalent to an annual effective rate — NOMINAL(r, 12) / 12. */
export const monthlyRate = (annual) => (1 + annual) ** (1 / 12) - 1;
/** Return after inflation. */
export const realRate = (ret, infl) => (1 + ret) / (1 + infl) - 1;

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const r2 = (n) => Math.round(n * 100) / 100;
/** One year of monthly investing at the start of each month. */
const yearEnd = (start, monthly, annualReturn) => fv(monthlyRate(annualReturn), 12, -monthly, -start, 1);

/* ── Retirement ────────────────────────────────────────────────── */
export const RETIREMENT_DEFAULTS = {
  age: 30, retireAge: 60, lifeAge: 85, monthlyExpense: 40000,
  inflation: 0.06, preReturn: 0.12, postReturn: 0.08, postInflation: 0.06, saved: 0,
};

export function retirement(input) {
  const p = { ...RETIREMENT_DEFAULTS, ...input };
  const years = Math.max(0, num(p.retireAge) - num(p.age));
  const months = Math.max(0, (num(p.lifeAge) - num(p.retireAge)) * 12);
  const expenseAtRetirement = fv(num(p.inflation), years, 0, -num(p.monthlyExpense), 0);
  const realMonthly = monthlyRate(realRate(num(p.postReturn), num(p.postInflation)));
  const corpus = months > 0 ? pv(realMonthly, months, -expenseAtRetirement, 0, 1) : 0;
  // Saved today, grown until retirement
  const savedGrows = fv(num(p.preReturn), years, 0, -num(p.saved), 0);
  const gap = Math.max(0, corpus - savedGrows);
  const sip = years > 0 ? Math.max(0, -pmt(monthlyRate(num(p.preReturn)), years * 12, -num(p.saved), corpus, 1)) : gap;

  // After retirement: month by month, the corpus pays an expense that rises
  // with inflation and earns the post-retirement return on what's left —
  // the same assumptions the corpus was worked out with, so it lasts exactly.
  const drawdown = [];
  const mRet = monthlyRate(num(p.postReturn)), mInf = monthlyRate(num(p.postInflation));
  let c = corpus, monthly = expenseAtRetirement;
  for (let age = num(p.retireAge) + 1; age <= num(p.lifeAge) && drawdown.length < 80; age++) {
    const start = c; let spent = 0;
    for (let i = 0; i < 12; i++) { c = (c - monthly) * (1 + mRet); spent += monthly; monthly *= 1 + mInf; }
    drawdown.push({ age, start: r2(start), expense: r2(spent), end: r2(c) });
  }
  return { years, months, expenseAtRetirement: r2(expenseAtRetirement), corpus: r2(corpus), savedGrows: r2(savedGrows), gap: r2(gap), sip: r2(sip), drawdown };
}

/* ── FIRE (financial independence, retire early) ───────────────── */
export const FIRE_DEFAULTS = {
  age: 28, fireAge: 45, annualIncome: 1200000, salaryGrowth: 0.08, annualExpense: 600000,
  inflation: 0.06, invested: 0, preReturn: 0.12, postReturn: 0.08, withdrawal: 0.04,
};

function fireBuild(p, untilAge) {
  const rows = [];
  let start = num(p.invested), income = num(p.annualIncome), expense = num(p.annualExpense);
  for (let age = num(p.age); age <= untilAge && rows.length < 80; age++) {
    const invest = income - expense;
    const end = yearEnd(start, invest / 12, num(p.preReturn));
    rows.push({ age, start: r2(start), income: r2(income), expense: r2(expense), invest: r2(invest), end: r2(end) });
    start = end; income *= 1 + num(p.salaryGrowth); expense *= 1 + num(p.inflation);
  }
  return rows;
}

/** How long a corpus lasts if each year's expense is taken out (rising with inflation). */
export function corpusLasts(corpus, firstYearExpense, ret, infl, fromAge, maxAge = 100) {
  let c = corpus, e = firstYearExpense;
  for (let age = fromAge; age <= maxAge; age++) {
    if (c < e) return { lastsUntil: age - 1, forever: false };
    c = (c - e) * (1 + ret); e *= 1 + infl;
  }
  return { lastsUntil: maxAge, forever: true };
}

export function fire(input) {
  const p = { ...FIRE_DEFAULTS, ...input };
  const rows = fireBuild(p, num(p.fireAge));
  const yearsCounted = rows.length;
  // The yearly expense when you stop working (as the sheet: grown for every year counted)
  const expenseAtFire = fv(num(p.inflation), yearsCounted, 0, -num(p.annualExpense), 1);
  const multiple = num(p.withdrawal) > 0 ? 1 / num(p.withdrawal) : 25;
  const fireNumber = expenseAtFire * multiple;
  const fireNumber30 = expenseAtFire * 30;
  const corpus = rows.length ? Math.max(...rows.map((r) => r.end)) : num(p.invested);
  const achieved = corpus >= fireNumber;

  // The earliest age the corpus covers the FIRE number of that age (looking to 70)
  let earliest = null;
  for (const r of fireBuild(p, Math.max(num(p.fireAge), 70))) {
    const need = fv(num(p.inflation), r.age - num(p.age) + 1, 0, -num(p.annualExpense), 1) * multiple;
    if (r.end >= need) { earliest = r.age; break; }
  }
  const lasts = corpusLasts(corpus, expenseAtFire, num(p.postReturn), num(p.inflation), num(p.fireAge) + 1);
  return {
    rows, expenseAtFire: r2(expenseAtFire), fireNumber: r2(fireNumber), fireNumber30: r2(fireNumber30), multiple,
    corpus: r2(corpus), achieved, shortBy: r2(Math.max(0, fireNumber - corpus)), earliest, ...lasts,
  };
}

/* ── A child's education (or any goal with a date) ─────────────── */
export const EDUCATION_DEFAULTS = {
  childAge: 3, goalAge: 18, cost: 2000000, inflation: 0.1, expectedReturn: 0.12, lumpSum: 0,
  plannedMonthly: 0, stepUp: 0.1,
};

export function education(input) {
  const p = { ...EDUCATION_DEFAULTS, ...input };
  const years = Math.max(0, num(p.goalAge) - num(p.childAge));
  const corpus = fv(num(p.inflation), years, 0, -num(p.cost), 0);
  const r = num(p.expectedReturn);
  const monthly = years > 0 ? Math.max(0, -pmt(monthlyRate(r), years * 12, -num(p.lumpSum), corpus, 1)) : 0;
  const yearly = years > 0 ? Math.max(0, -pmt(r, years, -num(p.lumpSum), corpus, 1)) : 0;
  const lumpSumNeeded = Math.max(0, -pv(r, years, 0, corpus, 0));
  // With your own plan: a monthly amount that rises every year
  let planned = null;
  if (num(p.plannedMonthly) > 0 && years > 0) {
    const s = stepUpSip({ monthly: num(p.plannedMonthly), years, expectedReturn: r, stepPct: num(p.stepUp), start: num(p.lumpSum) });
    planned = { value: s.value, invested: s.invested, enough: s.value >= corpus, shortBy: r2(Math.max(0, corpus - s.value)) };
  }
  return { years, corpus: r2(corpus), monthly: r2(monthly), yearly: r2(yearly), lumpSumNeeded: r2(lumpSumNeeded), planned };
}

/* ── Step-up SIP ───────────────────────────────────────────────── */
export const SIP_DEFAULTS = { monthly: 10000, years: 15, expectedReturn: 0.12, stepPct: 0.1, stepAmount: 0, holding: 0, start: 0 };

/**
 * A SIP that rises every year — by a percentage (stepPct) or a fixed amount
 * (stepAmount; used when > 0). After `years` the money stays invested for
 * `holding` more years with nothing added.
 */
export function stepUpSip(input) {
  const p = { ...SIP_DEFAULTS, ...input };
  const years = Math.max(0, Math.floor(num(p.years)));
  const total = years + Math.max(0, Math.floor(num(p.holding)));
  const rows = [];
  let start = num(p.start), monthly = num(p.monthly), invested = num(p.start);
  for (let y = 1; y <= total && y <= 80; y++) {
    const m = y <= years ? monthly : 0;
    const end = yearEnd(start, m, num(p.expectedReturn));
    invested += m * 12;
    rows.push({ year: y, start: r2(start), monthly: r2(m), end: r2(end) });
    start = end;
    if (y < years) monthly = num(p.stepAmount) > 0 ? monthly + num(p.stepAmount) : monthly * (1 + num(p.stepPct));
  }
  // The same SIP without the yearly raise, for comparison
  let flat = num(p.start);
  for (let y = 1; y <= total && y <= 80; y++) flat = yearEnd(flat, y <= years ? num(p.monthly) : 0, num(p.expectedReturn));
  return { rows, value: r2(start), invested: r2(invested), gain: r2(start - invested), flatValue: r2(flat) };
}
