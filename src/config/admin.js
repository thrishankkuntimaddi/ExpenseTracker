// ─── The app's owner ─────────────────────────────────────────────
// Accounts listed here (with a verified email) get Profile → "Admin sees":
// a READ-ONLY list of who uses the app — name, email, when they last opened
// it and last added an entry, how many entries they have. Never their money.
// firestore.rules (user_activity) holds the same list; keep the two in step.
export const ADMIN_EMAILS = ['thrishankkuntimaddi@gmail.com'];

export const isAdmin = (user) =>
  !!user?.email && user.emailVerified === true && ADMIN_EMAILS.includes(String(user.email).toLowerCase());
