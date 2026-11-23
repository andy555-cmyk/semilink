// Inquiry delivery. With API_URL set, inquiries are stored in the admin sheet and mailed by the server.
// Otherwise 'formsubmit' posts to FormSubmit (sends to the designated mailbox, no server needed);
// the first submission triggers a one-time activation email to that mailbox. Falls back to mailto on failure.
import {API_URL, call} from './api.js';
export const SUBMIT_MODE = 'formsubmit';
const FIELDS = [
  ['type', '1. User / Distributor / Manufacturer'], ['company', '2. Company Name'], ['location', '3. Business Location'],
  ['regno', '4. Business Registration Number'], ['name', '5. Contact Person Name'], ['mobile', '6. Contact (Mobile)'],
  ['email', '7. Contact (Email)'], ['message', '8. Inquiry']
];
export function inquiryLines(values) {
  return FIELDS.map(([k, label]) => `${label}: ${values[k] || '-'}`);
}
export function buildMailto(values, email) {
  const subject = `[SEMI LINK Inquiry] ${values.company || ''} (${values.type || ''})`;
  const body = [...inquiryLines(values), '', 'Privacy consent: Yes'].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export async function submitContact(values, email) {
  if (!values.privacy) throw new Error('Privacy consent required');
  if (API_URL) {
    const out = await call('contact', {...values, privacy: true}).catch(() => ({ok: false}));
    if (!out.ok) throw Object.assign(new Error('delivery failed'), { mailto: buildMailto(values, email) });
    return { mode: 'server' };
  }
  if (SUBMIT_MODE === 'formsubmit') {
    const payload = { _subject: `[SEMI LINK Inquiry] ${values.company || ''} (${values.type || ''})`, _template: 'table', _captcha: 'false', _replyto: values.email };
    FIELDS.forEach(([k, label]) => { payload[label] = values[k] || '-'; });
    payload._honey = values._honey || '';
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || String(json.success) === 'false') throw Object.assign(new Error('delivery failed'), { mailto: buildMailto(values, email) });
    return { mode: SUBMIT_MODE };
  }
  return { url: buildMailto(values, email), mode: 'mailto' };
}
