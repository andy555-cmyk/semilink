// SEMI LINK 관리자 화면 — 서버(Code.gs)의 admin_login · admin 동작만 부른다
// 로그인 토큰은 이 탭의 sessionStorage 에만 둔다(탭을 닫으면 끝) · 2시간 안 쓰면 서버가 토큰을 거절한다
import {esc} from './utils.js';
import {call} from './api.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#ad-modal');
const KEY = 'semilink.admin';
const IDLE_MS = 2 * 36e5;
const ss = (() => { try { return globalThis.sessionStorage; } catch { return null; } })();
let token = ss?.getItem(KEY) || '';
let lastUse = Number(ss?.getItem(KEY + '.t') || 0);
let tab = 'pending';
let db = null;            // overview 결과
let partState = {query: '', page: 1};
let logQuery = '';
let memberFilter = {query: '', status: ''};
let idleTimer;

const STATUS = ['대기', '승인', '거절', '차단'];
const INQ = ['신규', '연락함', '견적 발송', '완료', '보류'];
const PART_FIELDS = [['분류ID', 'cat'], ['분류', 'catName'], ['장비사(OEM)', 'oem'], ['품번(Part No)', 'partNo'], ['설명', 'description'], ['장비(Tool)', 'tool'], ['크기', 'size'], ['소재', 'material']];
const REASON = {
  auth: '로그인이 끝났습니다 · 다시 로그인해 주세요', moved: '그사이 시트가 바뀌었습니다 · 새로 불러온 뒤 다시 해 주세요',
  invalid: '입력값을 확인해 주세요', busy: '시도가 너무 많습니다 · 잠시 후 다시 해 주세요', server: '서버 오류입니다 · 잠시 후 다시 해 주세요',
  network: '인터넷 연결을 확인해 주세요', nodoc: '첨부된 사업자등록증이 없습니다', not_set: '관리자 비밀번호가 아직 정해지지 않았습니다',
  short: '새 비밀번호는 10자 이상이어야 합니다', wrong: '현재 비밀번호가 맞지 않습니다'
};

function saveToken(t) { token = t || ''; lastUse = Date.now(); if (token) { ss?.setItem(KEY, token); ss?.setItem(KEY + '.t', String(lastUse)); } else { ss?.removeItem(KEY); ss?.removeItem(KEY + '.t'); } armIdle(); }
function armIdle() { clearTimeout(idleTimer); if (token) idleTimer = setTimeout(() => logout('오래 쓰지 않아 로그아웃했습니다'), Math.max(0, lastUse + IDLE_MS - Date.now())); }
function logout(message) { saveToken(''); db = null; renderLogin(message); }

async function api(op, payload = {}) {
  let out;
  try { out = await call('admin', {token, op, ...payload}); } catch { return {ok: false, reason: 'network'}; }
  if (out.token) saveToken(out.token);
  if (!out.ok && out.reason === 'auth') { logout(REASON.auth); }
  return out;
}
function toast(msg) { const el = document.querySelector('#ad-toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3600); }
const fail = out => toast(REASON[out.reason] || REASON.server);
const nbsp = s => esc(s).replace(/(\d) (건|명|개|회|곳)/g, '$1&nbsp;$2');

/* ───── 로그인 ───── */
function renderLogin(message = '') {
  document.body.dataset.view = 'login';
  app.innerHTML = `<main class="ad-login">
    <form class="ad-login-box" data-form="login" novalidate>
      <a class="ad-logo" href="./" aria-label="SEMI LINK 첫 화면">SEMI LINK</a>
      <h1>관리자 로그인</h1>
      <p class="ad-sub">회원 승인 · 문의 · 품번을 관리하는 화면</p>
      <label for="ad-pw">관리자 비밀번호</label>
      <input id="ad-pw" name="password" type="password" autocomplete="current-password" required>
      <p class="ad-msg" role="alert">${esc(message)}</p>
      <button class="ad-btn primary wide" type="submit">로그인</button>
      <p class="ad-note">5번 틀리면 30분 동안 잠깁니다<br>2시간 쓰지 않으면 자동으로 로그아웃됩니다</p>
      <a class="ad-back" href="./">홈페이지로 돌아가기</a>
    </form>
  </main>`;
  app.querySelector('#ad-pw').focus();
}
async function doLogin(form) {
  const btn = form.querySelector('button'), msg = form.querySelector('.ad-msg');
  const pw = form.elements.password.value;
  if (!pw) { msg.textContent = '비밀번호를 입력해 주세요'; return; }
  btn.disabled = true; btn.textContent = '확인 중';
  let out; try { out = await call('admin_login', {password: pw}); } catch { out = {ok: false, reason: 'network'}; }
  btn.disabled = false; btn.textContent = '로그인';
  if (out.ok) { saveToken(out.token); tab = 'pending'; await load(); return; }
  form.elements.password.value = '';
  msg.textContent = out.reason === 'wrong' ? `비밀번호가 맞지 않습니다 · ${out.left}번 더 틀리면 30분 동안 잠깁니다`
    : out.reason === 'locked' ? `여러 번 틀려 잠겼습니다 · ${out.until} 이후 다시 해 주세요` : (REASON[out.reason] || REASON.server);
}

/* ───── 바탕 화면 ───── */
const TABS = [['pending', '승인 대기'], ['members', '회원'], ['inquiries', '문의'], ['parts', '품번'], ['logs', '조회기록'], ['blocked', '차단 도메인'], ['password', '비밀번호 바꾸기']];
function counts() {
  const m = db?.members || [], q = db?.inquiries || [];
  return {members: m.length, pending: m.filter(x => x.status === '대기').length, buyers: m.filter(x => x.type === '구매사' && x.status === '승인').length, newInq: q.filter(x => x.status === '신규').length, parts: db?.parts || 0, today: db?.todayLogs || 0};
}
async function load(keepTab = true) {
  if (!db) app.innerHTML = '<div class="ad-loading" role="status">자료를 불러오고 있습니다</div>';
  const out = await api('overview');
  if (!out.ok) { if (out.reason !== 'auth') { fail(out); if (!db) renderLogin(REASON[out.reason] || REASON.server); } return; }
  db = out; if (!keepTab) tab = 'pending';
  renderShell();
}
function renderShell() {
  document.body.dataset.view = 'admin';
  const c = counts();
  const badge = id => id === 'pending' && c.pending ? `<span class="ad-count">${c.pending}</span>` : id === 'inquiries' && c.newInq ? `<span class="ad-count">${c.newInq}</span>` : '';
  app.innerHTML = `<header class="ad-top">
      <a class="ad-logo" href="./" aria-label="SEMI LINK 첫 화면">SEMI LINK <span>관리자</span></a>
      <div class="ad-top-act"><button class="ad-btn ghost" data-act="reload" type="button">새로 불러오기</button><button class="ad-btn ghost" data-act="logout" type="button">로그아웃</button></div>
    </header>
    <div class="ad-body">
      <nav class="ad-nav" aria-label="관리 메뉴">${TABS.map(([id, t]) => `<button type="button" data-tab="${id}" class="${tab === id ? 'on' : ''}" ${tab === id ? 'aria-current="page"' : ''}>${t}${badge(id)}</button>`).join('')}</nav>
      <main class="ad-main" id="ad-main" tabindex="-1">
        <dl class="ad-stats">
          <div><dt>전체 회원</dt><dd>${c.members}</dd></div>
          <div class="${c.pending ? 'hot' : ''}"><dt>승인 대기</dt><dd>${c.pending}</dd></div>
          <div><dt>승인된 구매사</dt><dd>${c.buyers}</dd></div>
          <div class="${c.newInq ? 'hot' : ''}"><dt>새 문의</dt><dd>${c.newInq}</dd></div>
          <div><dt>등록 품번</dt><dd>${c.parts.toLocaleString('ko-KR')}</dd></div>
          <div><dt>오늘 품번 조회</dt><dd>${c.today}</dd></div>
        </dl>
        <section id="ad-pane" class="ad-pane"></section>
      </main>
    </div>`;
  renderPane();
}
function renderPane() {
  const pane = document.querySelector('#ad-pane'); if (!pane) return;
  ({pending: paneP, members: paneM, inquiries: paneI, parts: paneParts, logs: paneLogs, blocked: paneB, password: panePw})[tab](pane);
}
const head = (title, desc, extra = '') => `<div class="ad-pane-head"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>${extra}</div>`;
const empty = t => `<div class="ad-empty">${t}</div>`;
const statusTag = s => `<span class="ad-st st-${esc({대기: 'wait', 승인: 'ok', 거절: 'no', 차단: 'no', 신규: 'wait', 연락함: 'mid', '견적 발송': 'mid', 완료: 'ok', 보류: 'no'}[s] || 'mid')}">${esc(s || '-')}</span>`;
const opts = (list, cur) => list.map(v => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');

/* 승인 대기 */
function paneP(pane) {
  const list = db.members.filter(m => m.status === '대기').reverse();
  pane.innerHTML = head('승인 대기', '사업자등록증을 확인하고 승인하면 구매사는 바로 파트넘버 검색을 쓸 수 있습니다 · 공급사는 승인해도 검색은 막혀 있습니다',
    `<label class="ad-check"><input type="checkbox" id="ad-notify" checked> 승인하면 회원에게 안내 메일 보내기</label>`) +
    (list.length ? `<div class="ad-cards">${list.map(m => `<article class="ad-card">
      <div class="ad-card-top"><h3>${esc(m.company)}</h3><span class="ad-type ${m.type === '공급사' ? 'sup' : ''}">${esc(m.type)}</span></div>
      <dl class="ad-kv"><div><dt>담당자</dt><dd>${esc(m.name)}</dd></div><div><dt>사업자등록번호</dt><dd>${esc(m.biz || '-')}</dd></div>
        <div><dt>이메일</dt><dd><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></dd></div><div><dt>휴대전화</dt><dd>${m.mobile ? `<a href="tel:${esc(String(m.mobile).replace(/\D/g, ''))}">${esc(m.mobile)}</a>` : '-'}</dd></div>
        <div><dt>가입</dt><dd>${esc(m.at)}</dd></div></dl>
      <div class="ad-card-act">
        <button class="ad-btn" type="button" data-doc="${m.row}" data-email="${esc(m.email)}" ${m.hasDoc ? '' : 'disabled'}>${m.hasDoc ? '사업자등록증 보기' : '첨부 없음'}</button>
        <span class="ad-sp"></span>
        <button class="ad-btn danger" type="button" data-set="거절" data-row="${m.row}" data-email="${esc(m.email)}">거절</button>
        <button class="ad-btn primary" type="button" data-set="승인" data-row="${m.row}" data-email="${esc(m.email)}">승인</button>
      </div></article>`).join('')}</div>` : empty('승인을 기다리는 가입이 없습니다'));
}

/* 회원 */
function paneM(pane) {
  const q = memberFilter.query.toLowerCase();
  const list = db.members.filter(m => (!memberFilter.status || m.status === memberFilter.status) && (!q || [m.company, m.name, m.email, m.biz].join(' ').toLowerCase().includes(q))).reverse();
  pane.innerHTML = head('회원', `모두 ${nbsp(db.members.length + ' 명')} · 줄을 누르면 상태·만료일·메모를 고칠 수 있습니다`) +
    `<form class="ad-filter" data-form="member-filter" role="search"><input name="q" type="search" placeholder="회사명 · 이름 · 이메일 · 사업자번호" value="${esc(memberFilter.query)}" aria-label="회원 검색">
      <select name="status" aria-label="상태로 거르기"><option value="">모든 상태</option>${opts(STATUS, memberFilter.status)}</select><button class="ad-btn" type="submit">찾기</button></form>` +
    (list.length ? `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>회사명</th><th>담당자</th><th>유형</th><th>상태</th><th>이용 만료일</th><th>최근 로그인</th><th>가입</th></tr></thead><tbody>
      ${list.map(m => `<tr data-member="${m.row}" tabindex="0"><td><b>${esc(m.company)}</b><small>${esc(m.email)}</small></td><td>${esc(m.name)}</td><td>${esc(m.type)}</td><td>${statusTag(m.status)}</td><td>${esc(m.expire || '무기한')}</td><td>${esc(m.lastLogin || '-')}</td><td>${esc(String(m.at).slice(0, 10))}</td></tr>`).join('')}
    </tbody></table></div>` : empty('맞는 회원이 없습니다'));
}
function memberModal(row) {
  const m = db.members.find(x => x.row === row); if (!m) return;
  openModal(`${esc(m.company)} · ${esc(m.name)}`, `<form class="ad-form" data-form="member" data-row="${m.row}" data-email="${esc(m.email)}">
    <dl class="ad-kv"><div><dt>이메일</dt><dd>${esc(m.email)}</dd></div><div><dt>휴대전화</dt><dd>${esc(m.mobile || '-')}</dd></div><div><dt>사업자등록번호</dt><dd>${esc(m.biz || '-')}</dd></div><div><dt>로그인</dt><dd>${esc(m.count || 0)}회 · 최근 ${esc(m.lastLogin || '-')}</dd></div></dl>
    <div class="ad-grid2">
      <label>상태<select name="status">${opts(STATUS, m.status)}</select></label>
      <label>회원 유형<select name="type">${opts(['구매사', '공급사'], m.type)}</select></label>
      <label>이용 만료일<input name="expire" type="date" value="${esc(m.expire)}"><small>비워 두면 무기한</small></label>
      <label class="ad-check inline"><input type="checkbox" name="notify" ${m.status === '승인' ? '' : 'checked'}> 승인으로 바꾸면 안내 메일 보내기</label>
    </div>
    <label>메모<textarea name="memo" rows="3">${esc(m.memo)}</textarea></label>
    <div class="ad-form-act"><button class="ad-btn" type="button" data-doc="${m.row}" data-email="${esc(m.email)}" ${m.hasDoc ? '' : 'disabled'}>${m.hasDoc ? '사업자등록증 보기' : '첨부 없음'}</button><span class="ad-sp"></span><button class="ad-btn ghost" type="button" data-close>닫기</button><button class="ad-btn primary" type="submit">저장</button></div>
  </form>`);
}

/* 문의 */
function paneI(pane) {
  const list = db.inquiries.slice().reverse();
  pane.innerHTML = head('문의', `모두 ${nbsp(list.length + ' 건')} · 처리 상태를 바꾸면 바로 저장됩니다`) +
    (list.length ? `<div class="ad-inq">${list.map(q => `<details class="ad-inq-item" ${q.status === '신규' ? 'open' : ''}>
      <summary><span class="ad-inq-main"><b>${esc(q.company)}</b> ${esc(q.name)} · ${esc(q.type)}</span><span class="ad-inq-side">${statusTag(q.status)}<time>${esc(q.at)}</time></span></summary>
      <div class="ad-inq-body">
        <dl class="ad-kv"><div><dt>이메일</dt><dd><a href="mailto:${esc(q.email)}">${esc(q.email)}</a></dd></div><div><dt>휴대전화</dt><dd>${esc(q.mobile || '-')}</dd></div><div><dt>사업장 위치</dt><dd>${esc(q.location || '-')}</dd></div><div><dt>사업자등록번호</dt><dd>${esc(q.regno || '-')}</dd></div></dl>
        <p class="ad-inq-msg">${esc(q.message)}</p>
        <form class="ad-inq-form" data-form="inquiry" data-row="${q.row}" data-email="${esc(q.email)}">
          <label>처리 상태<select name="status">${opts(INQ, q.status)}</select></label>
          <label class="grow">담당 메모<input name="memo" value="${esc(q.memo)}"></label>
          <button class="ad-btn primary" type="submit">저장</button>
        </form>
      </div></details>`).join('')}</div>` : empty('아직 들어온 문의가 없습니다'));
}

/* 품번 */
async function paneParts(pane) {
  pane.innerHTML = head('품번', '사이트 파트넘버 검색의 원본입니다 · 고치면 바로 반영됩니다', '<button class="ad-btn primary" type="button" data-part-new>품번 추가</button>') +
    `<form class="ad-filter" data-form="part-filter" role="search"><input name="q" type="search" placeholder="품번 · 설명 · 장비사 · 소재" value="${esc(partState.query)}" aria-label="품번 검색"><button class="ad-btn" type="submit">찾기</button></form><div id="ad-parts">${empty('불러오고 있습니다')}</div>`;
  const out = await api('parts', {query: partState.query, page: partState.page});
  const box = document.querySelector('#ad-parts'); if (!box) return;
  if (!out.ok) { box.innerHTML = empty(REASON[out.reason] || REASON.server); return; }
  partState.page = out.page; partState.cats = out.cats; partState.rows = out.rows;
  box.innerHTML = out.rows.length ? `<p class="ad-meta">${nbsp(out.total.toLocaleString('ko-KR') + ' 건')} 중 ${out.page} / ${out.pages}쪽</p><div class="ad-table-wrap"><table class="ad-table parts"><thead><tr><th>품번</th><th>분류</th><th>장비사</th><th>설명</th><th>장비</th><th>크기</th><th>소재</th></tr></thead><tbody>
    ${out.rows.map(r => `<tr data-part="${r.row}" tabindex="0"><td><b>${esc(r.v[3])}</b></td><td>${esc(r.v[1])}</td><td>${esc(r.v[2])}</td><td>${esc(r.v[4])}</td><td>${esc(r.v[5])}</td><td>${esc(r.v[6])}</td><td>${esc(r.v[7])}</td></tr>`).join('')}</tbody></table></div>
    <div class="ad-pager"><button class="ad-btn" type="button" data-page="${out.page - 1}" ${out.page <= 1 ? 'disabled' : ''}>이전</button><span>${out.page} / ${out.pages}</span><button class="ad-btn" type="button" data-page="${out.page + 1}" ${out.page >= out.pages ? 'disabled' : ''}>다음</button></div>`
    : empty('맞는 품번이 없습니다');
}
function partModal(row) {
  const r = row ? partState.rows.find(x => x.row === row) : null; const v = r ? r.v : ['', '', '', '', '', '', '', ''];
  const cats = Object.entries(partState.cats || {});
  openModal(r ? `품번 고치기 · ${esc(v[3])}` : '품번 추가', `<form class="ad-form" data-form="part" data-row="${r ? r.row : 0}" data-part-no="${esc(v[3])}">
    <div class="ad-grid2">
      <label>분류<select name="cat" required>${cats.map(([id, name]) => `<option value="${esc(id)}" data-name="${esc(name)}" ${id === v[0] ? 'selected' : ''}>${esc(name)} (${esc(id)})</option>`).join('')}</select></label>
      ${PART_FIELDS.slice(2).map(([label, name], i) => `<label class="${name === 'description' ? 'span2' : ''}">${label}<input name="${name}" value="${esc(v[i + 2])}" ${name === 'partNo' ? 'required' : ''}></label>`).join('')}
    </div>
    <div class="ad-form-act">${r ? '<button class="ad-btn danger" type="button" data-part-del>지우기</button>' : ''}<span class="ad-sp"></span><button class="ad-btn ghost" type="button" data-close>닫기</button><button class="ad-btn primary" type="submit">저장</button></div>
  </form>`);
}

/* 조회기록 */
async function paneLogs(pane) {
  pane.innerHTML = head('조회기록', '승인 회원이 무엇을 찾았는지 최근 것부터 300건까지 보여 줍니다') +
    `<form class="ad-filter" data-form="log-filter" role="search"><input name="q" type="search" placeholder="회사명 · 이메일 · 검색어" value="${esc(logQuery)}" aria-label="조회기록 검색"><button class="ad-btn" type="submit">찾기</button></form><div id="ad-logs">${empty('불러오고 있습니다')}</div>`;
  const out = await api('logs', {query: logQuery});
  const box = document.querySelector('#ad-logs'); if (!box) return;
  if (!out.ok) { box.innerHTML = empty(REASON[out.reason] || REASON.server); return; }
  box.innerHTML = out.rows.length ? `<p class="ad-meta">전체 ${nbsp(out.total.toLocaleString('ko-KR') + ' 건')}</p><div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>일시</th><th>회사명</th><th>이메일</th><th>검색어</th><th>분류</th><th>결과</th></tr></thead><tbody>
    ${out.rows.map(r => `<tr><td>${esc(r.at)}</td><td>${esc(r.company)}</td><td>${esc(r.email)}</td><td>${esc(r.query || '(전체 보기)')}</td><td>${esc(r.cat || '-')}</td><td class="num">${esc(r.count)}</td></tr>`).join('')}</tbody></table></div>` : empty('기록이 없습니다');
}

/* 차단 도메인 */
function paneB(pane) {
  pane.innerHTML = head('차단 도메인', '여기 넣은 회사 메일 도메인은 가입할 수 없습니다 · 경쟁사 등록용') +
    `<form class="ad-filter" data-form="block-add"><input name="domain" placeholder="예: competitor.co.kr" aria-label="막을 도메인" required><input name="memo" placeholder="메모(선택)" aria-label="메모"><button class="ad-btn primary" type="submit">추가</button></form>` +
    (db.blocked.length ? `<ul class="ad-list">${db.blocked.map(b => `<li><b>@${esc(b.domain)}</b><span>${esc(b.memo || '')}</span><button class="ad-btn danger small" type="button" data-block-del="${b.row}" data-domain="${esc(b.domain)}">빼기</button></li>`).join('')}</ul>` : empty('막아 둔 도메인이 없습니다'));
}

/* 비밀번호 */
function panePw(pane) {
  pane.innerHTML = head('비밀번호 바꾸기', '바꾸면 지금 로그인된 다른 기기도 모두 로그아웃됩니다') +
    `<form class="ad-form narrow" data-form="password" novalidate>
      <label>현재 비밀번호<input name="old" type="password" autocomplete="current-password" required></label>
      <label>새 비밀번호<input name="next" type="password" autocomplete="new-password" minlength="10" required><small>10자 이상</small></label>
      <label>새 비밀번호 한 번 더<input name="again" type="password" autocomplete="new-password" required></label>
      <p class="ad-msg" role="alert"></p>
      <div class="ad-form-act"><span class="ad-sp"></span><button class="ad-btn primary" type="submit">바꾸기</button></div>
    </form>`;
}

/* ───── 창 ───── */
function openModal(title, body) {
  modal.innerHTML = `<div class="ad-modal-bg" data-close></div><div class="ad-modal" role="dialog" aria-modal="true" aria-labelledby="ad-modal-title"><div class="ad-modal-head"><h3 id="ad-modal-title">${title}</h3><button class="ad-x" type="button" data-close aria-label="닫기">×</button></div><div class="ad-modal-body">${body}</div></div>`;
  modal.classList.add('on'); document.body.classList.add('ad-lock');
  setTimeout(() => modal.querySelector('select,input,textarea,button:not(.ad-x)')?.focus(), 30);
}
function closeModal() { const url = modal.dataset.url; if (url) URL.revokeObjectURL(url); delete modal.dataset.url; modal.classList.remove('on'); modal.innerHTML = ''; document.body.classList.remove('ad-lock'); }
async function showDoc(row, email, btn) {
  const label = btn.textContent; btn.disabled = true; btn.textContent = '여는 중';
  const out = await api('doc', {row, email});
  btn.disabled = false; btn.textContent = label;
  if (!out.ok) { fail(out); return; }
  const bytes = Uint8Array.from(atob(out.data), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type: out.type}));
  openModal(`사업자등록증 · ${esc(out.name)}`, `<div class="ad-doc">${out.type === 'application/pdf' ? `<iframe src="${url}" title="사업자등록증"></iframe>` : `<img src="${url}" alt="사업자등록증">`}</div><div class="ad-form-act"><a class="ad-btn" href="${url}" download="${esc(out.name)}">내려받기</a><span class="ad-sp"></span><button class="ad-btn ghost" type="button" data-close>닫기</button></div>`);
  modal.dataset.url = url;
}

/* ───── 고치기 ───── */
async function setMember(payload, btn) {
  if (btn) btn.disabled = true;
  const out = await api('member', payload);
  if (btn) btn.disabled = false;
  if (!out.ok) { fail(out); if (out.reason === 'moved') load(); return false; }
  const m = db.members.find(x => x.row === payload.row);
  if (m) { ['status', 'type', 'expire', 'memo'].forEach(k => { if (payload[k] != null) m[k] = payload[k]; }); }
  toast(payload.status === '승인' ? (out.mailed ? '승인했습니다 · 안내 메일을 보냈습니다' : '승인했습니다') : '저장했습니다');
  return true;
}

app.addEventListener('submit', onSubmit); modal.addEventListener('submit', onSubmit);
async function onSubmit(e) {
  const f = e.target; const kind = f.dataset.form; if (!kind) return; e.preventDefault();
  if (kind === 'login') return doLogin(f);
  if (kind === 'member-filter') { memberFilter = {query: f.elements.q.value.trim(), status: f.elements.status.value}; renderPane(); return; }
  if (kind === 'part-filter') { partState.query = f.elements.q.value.trim(); partState.page = 1; renderPane(); return; }
  if (kind === 'log-filter') { logQuery = f.elements.q.value.trim(); renderPane(); return; }
  const btn = f.querySelector('[type=submit]');
  if (kind === 'member') {
    const p = {row: Number(f.dataset.row), email: f.dataset.email, status: f.elements.status.value, type: f.elements.type.value, expire: f.elements.expire.value, memo: f.elements.memo.value, notify: f.elements.notify.checked};
    if (await setMember(p, btn)) { closeModal(); renderShell(); }
    return;
  }
  if (kind === 'inquiry') {
    btn.disabled = true;
    const p = {row: Number(f.dataset.row), email: f.dataset.email, status: f.elements.status.value, memo: f.elements.memo.value};
    const out = await api('inquiry', p); btn.disabled = false;
    if (!out.ok) { fail(out); if (out.reason === 'moved') load(); return; }
    const q = db.inquiries.find(x => x.row === p.row); if (q) Object.assign(q, {status: p.status, memo: p.memo});
    toast('저장했습니다'); renderShell(); return;
  }
  if (kind === 'part') {
    const sel = f.elements.cat; const v = [sel.value, sel.selectedOptions[0]?.dataset.name || '', ...PART_FIELDS.slice(2).map(([, n]) => f.elements[n].value.trim())];
    if (!v[3]) { toast('품번을 입력해 주세요'); return; }
    btn.disabled = true;
    const out = await api('part_save', {row: Number(f.dataset.row), partNo: f.dataset.partNo, values: v}); btn.disabled = false;
    if (!out.ok) { fail(out); return; }
    if (!Number(f.dataset.row)) db.parts++;
    closeModal(); toast('저장했습니다'); renderShell(); return;
  }
  if (kind === 'block-add') {
    btn.disabled = true;
    const out = await api('block_add', {domain: f.elements.domain.value, memo: f.elements.memo.value}); btn.disabled = false;
    if (!out.ok) { toast(out.reason === 'invalid' ? '도메인 모양을 확인해 주세요 · 예: competitor.co.kr' : (REASON[out.reason] || REASON.server)); return; }
    toast('추가했습니다'); load(); return;
  }
  if (kind === 'password') {
    const msg = f.querySelector('.ad-msg'); const {old, next, again} = f.elements;
    if (!old.value || !next.value) { msg.textContent = '모두 입력해 주세요'; return; }
    if (next.value.length < 10) { msg.textContent = REASON.short; return; }
    if (next.value !== again.value) { msg.textContent = '새 비밀번호 두 칸이 다릅니다'; return; }
    btn.disabled = true;
    const out = await api('password', {old: old.value, next: next.value}); btn.disabled = false;
    if (!out.ok) { msg.textContent = REASON[out.reason] || REASON.server; return; }
    logout('비밀번호를 바꿨습니다 · 새 비밀번호로 다시 로그인해 주세요');
  }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-close],tr[data-member],tr[data-part]'); if (!t) return;
  if (t.matches('[data-close]')) { closeModal(); return; }
  if (t.dataset.tab) { tab = t.dataset.tab; renderShell(); document.querySelector('#ad-main')?.focus({preventScroll: true}); return; }
  if (t.dataset.act === 'logout') { logout('로그아웃했습니다'); return; }
  if (t.dataset.act === 'reload') { await load(); toast('새로 불러왔습니다'); return; }
  if (t.dataset.doc) { showDoc(Number(t.dataset.doc), t.dataset.email, t); return; }
  if (t.dataset.set) {
    const m = db.members.find(x => x.row === Number(t.dataset.row));
    if (t.dataset.set === '거절' && !confirm(`${m?.company || ''} 가입을 거절할까요? 거절하면 로그인할 수 없습니다`)) return;
    const notify = document.querySelector('#ad-notify')?.checked;
    if (await setMember({row: Number(t.dataset.row), email: t.dataset.email, status: t.dataset.set, notify}, t)) renderShell();
    return;
  }
  if (t.dataset.member) { memberModal(Number(t.dataset.member)); return; }
  if (t.dataset.part) { partModal(Number(t.dataset.part)); return; }
  if (t.hasAttribute('data-part-new')) { if (!partState.cats) await paneParts(document.querySelector('#ad-pane')); partModal(0); return; }
  if (t.dataset.page) { partState.page = Number(t.dataset.page); renderPane(); return; }
  if (t.hasAttribute('data-part-del')) {
    const f = t.closest('form'); if (!confirm(`품번 ${f.dataset.partNo}을(를) 지울까요? 사이트 검색에서도 사라집니다`)) return;
    const out = await api('part_delete', {row: Number(f.dataset.row), partNo: f.dataset.partNo});
    if (!out.ok) { fail(out); return; }
    db.parts--; closeModal(); toast('지웠습니다'); renderShell(); return;
  }
  if (t.dataset.blockDel) {
    if (!confirm(`@${t.dataset.domain} 차단을 풀까요?`)) return;
    const out = await api('block_delete', {row: Number(t.dataset.blockDel), domain: t.dataset.domain});
    if (!out.ok) { fail(out); return; }
    toast('차단을 풀었습니다'); load();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('on')) closeModal();
  if (e.key === 'Enter' && e.target.matches('tr[data-member],tr[data-part]')) e.target.click();
});

if (token && lastUse + IDLE_MS > Date.now()) { armIdle(); load(); } else { saveToken(''); renderLogin(); }
