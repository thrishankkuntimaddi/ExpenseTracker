// ─── Spending categories ─────────────────────────────────────────
// Expenses are free-text ("Swiggy", "petrol", "chai"). Categories are inferred
// from the name with an India-aware keyword list, and the user can override
// per entry. Overrides are learned as rules (settings.categoryRules) keyed by
// the normalised name, so the next "Swiggy" lands in the right bucket.
//
// Everything here is pure so it can be unit-tested and reused by the
// insights / budget maths.

export const CATEGORIES = [
  { key: 'food',          label: 'Food & Dining',      light: '#F97316', dark: '#FB923C', icon: 'Utensils',
    keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'chai', 'tea', 'lunch', 'dinner', 'breakfast',
      'snack', 'snacks', 'biryani', 'pizza', 'burger', 'dosa', 'idli', 'tiffin', 'canteen', 'mess', 'hotel', 'juice',
      'icecream', 'ice cream', 'dominos', 'mcdonalds', 'mcdonald', 'kfc', 'starbucks', 'bakery', 'sweets', 'momos',
      'paratha', 'thali', 'dhaba', 'food', 'meal', 'samosa', 'chaat', 'chocolate', 'cake', 'eating out', 'eatfit',
      'subway', 'barbeque', 'bbq', 'shawarma', 'noodles', 'maggi', 'cold drink', 'lassi', 'milkshake', 'dessert'] },
  { key: 'groceries',     label: 'Groceries',          light: '#65A30D', dark: '#A3E635', icon: 'ShoppingBasket',
    keywords: ['grocery', 'groceries', 'vegetables', 'veggies', 'fruits', 'milk', 'dmart', 'bigbasket', 'blinkit',
      'zepto', 'instamart', 'supermarket', 'kirana', 'rice', 'atta', 'dal', 'eggs', 'curd', 'bread', 'ration',
      'jiomart', 'reliance fresh', 'more supermarket', 'provisions', 'oil', 'sugar', 'onion', 'tomato', 'paneer'] },
  { key: 'transport',     label: 'Transport',          light: '#0284C7', dark: '#38BDF8', icon: 'Car',
    keywords: ['uber', 'ola', 'rapido', 'auto', 'cab', 'taxi', 'metro', 'bus', 'train', 'irctc', 'toll', 'parking',
      'rickshaw', 'namma yatri', 'bmtc', 'tsrtc', 'apsrtc', 'ksrtc', 'redbus', 'fastag', 'local train', 'commute',
      'bike taxi', 'yulu', 'bounce'] },
  { key: 'fuel',          label: 'Fuel',               light: '#B45309', dark: '#F59E0B', icon: 'Fuel',
    keywords: ['petrol', 'diesel', 'fuel', 'cng', 'indian oil', 'hp petrol', 'bharat petroleum', 'shell', 'nayara'] },
  { key: 'shopping',      label: 'Shopping',           light: '#DB2777', dark: '#F472B6', icon: 'ShoppingBag',
    keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'clothes', 'shirt', 'jeans', 'shoes', 'dress',
      'mall', 'shopping', 'electronics', 'headphones', 'earphones', 'phone', 'mobile', 'cover', 'decathlon', 'zara',
      'zudio', 'tshirt', 't-shirt', 'kurta', 'saree', 'watch', 'bag', 'sandals', 'jacket', 'croma', 'reliance digital',
      'laptop', 'charger', 'cable', 'gadget'] },
  { key: 'bills',         label: 'Bills & Utilities',  light: '#4F46E5', dark: '#818CF8', icon: 'Receipt',
    keywords: ['electricity', 'electric bill', 'current bill', 'water bill', 'gas', 'lpg', 'cylinder', 'wifi',
      'broadband', 'internet', 'recharge', 'jio', 'airtel', 'vi ', 'vodafone', 'bsnl', 'postpaid', 'prepaid', 'dth',
      'tata sky', 'tata play', 'bill', 'maintenance', 'society', 'bescom', 'tneb', 'tsspdcl', 'apspdcl', 'act fibernet',
      'emi', 'loan', 'credit card', 'insurance', 'premium'] },
  { key: 'rent',          label: 'Rent & Home',        light: '#7C3AED', dark: '#A78BFA', icon: 'Home',
    keywords: ['rent', 'house rent', 'pg', 'hostel', 'deposit', 'flat', 'maid', 'cook', 'cleaning', 'plumber',
      'electrician', 'repair', 'furniture', 'mattress', 'curtains', 'kitchen', 'utensils', 'home'] },
  { key: 'health',        label: 'Health',             light: '#DC2626', dark: '#F87171', icon: 'HeartPulse',
    keywords: ['medicine', 'medicines', 'pharmacy', 'apollo', 'medplus', 'doctor', 'hospital', 'clinic', 'lab',
      'dentist', 'gym', 'protein', '1mg', 'pharmeasy', 'netmeds', 'tablets', 'consultation', 'checkup', 'health',
      'physio', 'eye', 'specs', 'spectacles', 'lens', 'vaccine', 'yoga', 'cult', 'cultfit'] },
  { key: 'entertainment', label: 'Entertainment',      light: '#9333EA', dark: '#C084FC', icon: 'Clapperboard',
    keywords: ['movie', 'movies', 'pvr', 'inox', 'cinema', 'bookmyshow', 'game', 'gaming', 'concert', 'party',
      'club', 'pub', 'bar', 'beer', 'wine', 'whisky', 'drinks', 'alcohol', 'bowling', 'outing', 'cricket', 'match',
      'stadium', 'event', 'show', 'theatre', 'arcade', 'ps5', 'steam'] },
  { key: 'subscriptions', label: 'Subscriptions',      light: '#0D9488', dark: '#2DD4BF', icon: 'Repeat',
    keywords: ['netflix', 'prime', 'amazon prime', 'hotstar', 'spotify', 'youtube', 'subscription', 'icloud',
      'google one', 'chatgpt', 'openai', 'claude', 'apple music', 'jiocinema', 'zee5', 'sonyliv', 'adobe', 'notion',
      'github', 'domain', 'hosting', 'aws', 'vercel', 'cursor', 'copilot', 'kindle', 'audible', 'gaana', 'wynk'] },
  { key: 'education',     label: 'Education',          light: '#2563EB', dark: '#60A5FA', icon: 'GraduationCap',
    keywords: ['course', 'udemy', 'coursera', 'book', 'books', 'tuition', 'fees', 'fee', 'college', 'school', 'exam',
      'stationery', 'pen', 'notebook', 'class', 'coaching', 'library', 'certification', 'workshop', 'print', 'xerox',
      'photocopy'] },
  { key: 'travel',        label: 'Travel',             light: '#0891B2', dark: '#22D3EE', icon: 'Plane',
    keywords: ['flight', 'indigo', 'air india', 'vistara', 'akasa', 'hotel booking', 'oyo', 'airbnb', 'makemytrip',
      'goibibo', 'trip', 'vacation', 'holiday', 'resort', 'visa', 'passport', 'travel', 'train ticket', 'bus ticket',
      'luggage', 'tour', 'homestay', 'cleartrip', 'ixigo', 'yatra'] },
  { key: 'personal',      label: 'Personal Care',      light: '#C026D3', dark: '#E879F9', icon: 'Sparkles',
    keywords: ['haircut', 'salon', 'barber', 'spa', 'parlour', 'parlor', 'grooming', 'cosmetics', 'nykaa',
      'skincare', 'soap', 'shampoo', 'laundry', 'dry clean', 'toiletries', 'perfume', 'deo', 'razor', 'trimmer',
      'facial', 'massage'] },
  { key: 'gifts',         label: 'Gifts & Donations',  light: '#E11D48', dark: '#FB7185', icon: 'Gift',
    keywords: ['gift', 'donation', 'temple', 'charity', 'puja', 'pooja', 'wedding', 'daan', 'church', 'mosque',
      'offering', 'festival', 'diwali', 'rakhi', 'bouquet', 'flowers', 'treat'] },
  { key: 'family',        label: 'Family',             light: '#D97706', dark: '#FBBF24', icon: 'Users',
    keywords: ['mom', 'dad', 'amma', 'nanna', 'mother', 'father', 'parents', 'sister', 'brother', 'wife', 'husband',
      'kids', 'baby', 'family', 'grandma', 'grandpa', 'son', 'daughter', 'pocket money'] },
  { key: 'other',         label: 'Other',              light: '#64748B', dark: '#94A3B8', icon: 'CircleDashed',
    keywords: [] },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
/** Stable empty rules object — use as the `?? EMPTY_RULES` fallback so hook deps don't churn. */
export const EMPTY_RULES = Object.freeze({});
const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function categoryMeta(key) {
  return BY_KEY[key] ?? BY_KEY.other;
}

export function categoryColor(key, theme) {
  const m = categoryMeta(key);
  return theme === 'monoflow' ? m.dark : m.light;
}

/* ── Name normalisation ──
   Rule keys are stored as Firestore map keys, which may not contain '.',
   '/', '[', ']', '*' or '`'. Collapse whitespace and strip those. */
export function normaliseName(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[.\\/[\]*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokenise = (s) => normaliseName(s).split(/[^a-z0-9&+-]+/).filter(Boolean);

/* ── Inference ──
   1. a learned rule for this exact name wins;
   2. then multi-word keywords (substring, e.g. "hotel booking" before "hotel");
   3. then single-word keywords against the tokens of the name;
   4. otherwise 'other'. */
export function inferCategory(name, rules = {}) {
  const norm = normaliseName(name);
  if (!norm) return 'other';
  const learned = rules[norm];
  if (learned && BY_KEY[learned]) return learned;

  const tokens = new Set(tokenise(norm));
  const padded = ` ${norm} `;

  for (const c of CATEGORIES) {
    for (const kw of c.keywords) {
      if (kw.includes(' ') && padded.includes(` ${kw.trim()} `)) return c.key;
    }
  }
  for (const c of CATEGORIES) {
    for (const kw of c.keywords) {
      if (!kw.includes(' ') && tokens.has(kw)) return c.key;
    }
  }
  // Partial-token fallback: "swiggyinstamart" → groceries, "ubereats" → food
  for (const c of CATEGORIES) {
    for (const kw of c.keywords) {
      if (kw.length >= 5 && norm.includes(kw)) return c.key;
    }
  }
  return 'other';
}

/** Category of a stored transaction: explicit field first, inference otherwise. */
export function categoryOf(txn, rules = {}) {
  if (txn?.type !== 'expense') return null;
  if (txn.category && BY_KEY[txn.category]) return txn.category;
  return inferCategory(txn.name, rules);
}

/**
 * Learn from an override. Returns the new rules map (or the same object when
 * nothing changes). Picking the inferred category removes a stale rule so the
 * keyword engine takes over again.
 */
export function learnCategoryRule(rules = {}, name, category) {
  const norm = normaliseName(name);
  if (!norm || !BY_KEY[category]) return rules;
  const inferredWithoutRule = inferCategory(name, {});
  if (inferredWithoutRule === category) {
    if (!(norm in rules)) return rules;
    const next = { ...rules };
    delete next[norm];
    return next;
  }
  if (rules[norm] === category) return rules;
  return { ...rules, [norm]: category };
}

/** Sum expenses per category for a list of transactions. Sorted by amount desc. */
export function categoryTotals(transactions = [], rules = {}) {
  const paise = {};
  const counts = {};
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    const key = categoryOf(t, rules);
    paise[key] = (paise[key] ?? 0) + Math.round((Number(t.amount) || 0) * 100);
    counts[key] = (counts[key] ?? 0) + 1;
  });
  const total = Object.values(paise).reduce((s, v) => s + v, 0);
  return Object.entries(paise)
    .map(([key, p]) => ({
      key,
      label: categoryMeta(key).label,
      amount: p / 100,
      count: counts[key],
      share: total > 0 ? (p / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
