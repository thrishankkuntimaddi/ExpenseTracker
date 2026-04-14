// ─── API Service (future server bridge) ──────────────────────────
// This file will proxy calls to /server once the Express backend
// is live. For now it's a typed stub so imports don't break.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API POST ${path} failed: ${res.status}`);
  return res.json();
}
