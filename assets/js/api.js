// SEMI LINK server (Google Apps Script web app). Empty = demo mode (browser-only, no real storage).
export const API_URL = 'https://script.google.com/macros/s/AKfycbyZGcRo1egrIUg8Ev4F84O39a9ButHSzlhFBz35staew0r7VHytoatWt3M_NVTzbGwxSg/exec';
export async function call(action, payload) {
  const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action }) });
  if (!res.ok) throw new Error('network');
  return res.json();
}
