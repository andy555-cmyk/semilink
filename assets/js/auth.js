// Server-backed membership when API_URL is set (passwords are hashed on the server, never stored here).
// The browser keeps only a signed session token, name and company. Without API_URL it falls back to a demo flag.
import {safeStorage} from './utils.js';
import {API_URL, call} from './api.js';
const SESSION_KEY = 'semilink.session';
const PROFILE_KEY = 'semilink.profile';
const MEMBER_KEY = 'semilink.member';
let memory = null;
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
function tokenAlive(token) {
  if (token === 'true') return !API_URL;
  try { const p = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); return p.x > Date.now(); } catch { return false; }
}
function save(token, profile) {
  memory = token;
  safeStorage(storage(), SESSION_KEY, token);
  safeStorage(storage(), PROFILE_KEY, JSON.stringify(profile || {}));
}
export function isLoggedIn() { const t = memory || safeStorage(storage(), SESSION_KEY); return !!t && t !== 'false' && tokenAlive(t); }
export function profile() { try { return JSON.parse(safeStorage(storage(), PROFILE_KEY) || '{}'); } catch { return {}; } }
const validSignup = v => v.company?.trim() && v.name?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || '') && (v.password || '').length >= 8 && ['buyer','supplier'].includes(v.memberType) && v.terms && v.privacy;
export async function signup(values) {
  if (!validSignup(values)) return {ok:false, reason:'invalid'};
  if (!API_URL) { safeStorage(storage(), MEMBER_KEY, 'true'); save('true', {name: values.name}); return {ok:true}; }
  try {
    const out = await call('signup', {company:values.company, name:values.name, email:values.email, mobile:values.mobile, password:values.password, memberType:values.memberType, terms:!!values.terms, privacy:!!values.privacy});
    if (out.ok) save(out.token, {name: out.name, company: out.company});
    return out;
  } catch { return {ok:false, reason:'network'}; }
}
export async function login(values) {
  if (!values.email?.trim() || !values.password) return {ok:false, reason:'invalid'};
  if (!API_URL) { if (safeStorage(storage(), MEMBER_KEY) !== 'true') return {ok:false, reason:'nomember'}; save('true', {}); return {ok:true}; }
  try {
    const out = await call('login', {email: values.email, password: values.password});
    if (out.ok) save(out.token, {name: out.name, company: out.company});
    return out;
  } catch { return {ok:false, reason:'network'}; }
}
export function logout() { memory = null; safeStorage(storage(), SESSION_KEY, 'false'); safeStorage(storage(), PROFILE_KEY, '{}'); }
