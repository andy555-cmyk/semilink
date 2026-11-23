export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const localized = (value, lang) => typeof value === 'object' && value !== null ? value[lang] ?? value.ko ?? '' : value;
export function filterProducts(rows, {query = '', oem = '', size = ''} = {}) {
  const term = query.trim().toLowerCase();
  return rows.filter(row => (!oem || row.oem === oem) && (!size || row.size.includes(size)) && (!term || [row.partNo, row.tool, row.description, row.oem, row.material].join(' ').toLowerCase().includes(term) || (normPart(term).length > 2 && normPart(row.partNo).includes(normPart(term)))));
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
// Part number search: hyphens, spaces and dots are ignored so "020035293" finds "0200-35293".
export const normPart = value => String(value ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
export function searchParts(rows, {query = '', category = '', oem = ''} = {}) {
  const term = query.trim().toLowerCase(), key = normPart(term);
  const scored = [];
  for (const row of rows) {
    if (category && row.cat?.id !== category) continue;
    if (oem && row.oem !== oem) continue;
    if (!term) { scored.push([3, row]); continue; }
    const pn = normPart(row.partNo);
    let score = -1;
    if (key && pn === key) score = 0;
    else if (key && pn.startsWith(key)) score = 1;
    else if (key && pn.includes(key)) score = 2;
    else if ([row.description, row.tool, row.oem, row.material, row.cat?.name, ...(row.variants || []).map(v => v.description)].join(' ').toLowerCase().includes(term)) score = 3;
    if (score >= 0) scored.push([score, row]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
