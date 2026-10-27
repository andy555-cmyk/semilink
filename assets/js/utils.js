export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const localized = (value, lang) => typeof value === 'object' && value !== null ? value[lang] ?? value.ko ?? '' : value;
export function filterProducts(rows, {query = '', oem = '', size = ''} = {}) {
  const term = query.trim().toLowerCase();
  return rows.filter(row => (!oem || row.oem === oem) && (!size || row.size.includes(size)) && (!term || [row.partNo, row.tool, row.description, row.oem, row.material].join(' ').toLowerCase().includes(term)));
}
export function paginate(rows, page = 1, perPage = 15) {
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(pages, Math.max(1, page));
  return {rows: rows.slice((current - 1) * perPage, current * perPage), page: current, pages, total: rows.length};
}
export function routeInfo(hash) {
  const [path, query = ''] = (hash.replace(/^#/, '') || '/').split('?');
  return {path, params: new URLSearchParams(query)};
}
export function safeStorage(storage, key, value) {
  try { if (value === undefined) return storage.getItem(key); storage.setItem(key, value); return true; } catch { return value === undefined ? null : false; }
}
