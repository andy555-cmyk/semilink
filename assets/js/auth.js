// Demonstration adapter only: no identity verification, server session or authorization.
// Store membership/session flags only. Never store passwords, names or email addresses.
// Replace this module with a server-backed auth provider before enabling paid access.
import {safeStorage} from './utils.js';
const MEMBER_KEY = 'semilink.member';
const SESSION_KEY = 'semilink.session';
let memoryMember = false;
let memorySession = false;
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
export function isLoggedIn() { return memorySession || safeStorage(storage(), SESSION_KEY) === 'true'; }
export function signup(values) {
  if (!values.company?.trim() || !values.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || (values.password || '').length < 8 || !['buyer','supplier'].includes(values.memberType) || !values.terms || !values.privacy) return {ok:false, reason:'invalid'};
  memoryMember = true;
  memorySession = true;
  safeStorage(storage(), MEMBER_KEY, 'true');
  safeStorage(storage(), SESSION_KEY, 'true');
  return {ok:true};
}
export function login(values) {
  if (!values.email?.trim() || !values.password) return {ok:false, reason:'invalid'};
  if (!memoryMember && safeStorage(storage(), MEMBER_KEY) !== 'true') return {ok:false, reason:'membership'};
  memorySession = true;
  safeStorage(storage(), SESSION_KEY, 'true');
  return {ok:true};
}
export function logout() { memorySession = false; safeStorage(storage(), SESSION_KEY, 'false'); }
