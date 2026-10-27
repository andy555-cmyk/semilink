import {esc, localized, filterProducts, paginate, routeInfo, safeStorage} from './utils.js';
import * as auth from './auth.js';
import {submitContact} from './contact.js';
import {icon, waferVisual, chamberSVG} from './diagrams.js';

const main = document.querySelector('#main');
const header = document.querySelector('#header');
const footer = document.querySelector('#footer');
const modalRoot = document.querySelector('#modal-root');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let lang = safeStorage(storage, 'semilink.language') === 'en' ? 'en' : 'ko';
const L = (ko,en) => lang === 'ko' ? ko : en;
const loc = value => localized(value, lang);
const cache = new Map();
let data, routeVersion = 0, pageCleanup = () => {}, lastModalFocus, toastTimer, modalOnSuccess;
let explorer = {part:null,material:null,supplier:null};
let activeChamber = null;
let catalogState = {query:'', oem:'', size:'', page:1};
let catalogRows = [];
let currentCategory;
const titles = () => ({'/':L('반도체 부품의 새로운 연결','A new connection for semiconductor parts'),'/company':L('회사소개','Company'),'/front/etch':L('식각 공정','Etch process'),'/front/deposition':L('증착 공정','Deposition process'),'/back':L('후공정','Back-end processes'),'/products':L('제품','Products'),'/contact':L('문의하기','Contact'),'/login':L('로그인','Log in'),'/signup':L('회원가입','Sign up'),'/privacy':L('개인정보처리방침','Privacy policy'),'/terms':L('이용약관','Terms of use')});
async function getJSON(path) {
  if (!cache.has(path)) cache.set(path, fetch(path).then(response => { if (!response.ok) throw new Error(`${path}: ${response.status}`); return response.json(); }).catch(error=>{cache.delete(path);throw error;}));
  return cache.get(path);
}
const logo = () => `<span class="logo-mark">${icon('link')}</span><span class="logo-word">SEMI LINK<span class="logo-tag">SEMICONDUCTOR SOLUTION PROVIDER</span></span>`;
const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
const button = (href,text,style='primary') => `<a class="btn ${style}" href="${esc(href)}">${text}${arrow}</a>`;
const photo = (img,alt) => img ? `<img src="${esc(img.src)}" alt="${esc(alt)}" width="${img.width}" height="${img.height}" loading="lazy" decoding="async">` : icon('wafer');
function nav() {
  const {path}=routeInfo(location.hash);
  const link=(href,text)=>`<a href="#${href}" ${path===href?'class="current" aria-current="page"':''}>${text}</a>`;
  const account=auth.isLoggedIn()?`<button class="auth-action" data-action="logout">${L('로그아웃','Log out')}</button>`:`<a class="auth-action" href="#/login">${L('로그인','Log in')}</a><a class="btn outline auth-action" href="#/signup">${L('회원가입','Sign up')}</a>`;
  header.innerHTML=`<div class="container header-inner"><a class="logo" href="#/" aria-label="SEMI LINK ${L('첫 화면','home')}">${logo()}</a><nav class="primary-nav" id="primary-nav" aria-label="${L('주 메뉴','Main navigation')}">${link('/company',L('회사소개','Company'))}<div class="nav-group"><button data-action="front-menu" aria-expanded="false" aria-controls="front-menu" ${path.startsWith('/front')?'class="current"':''}>${L('전공정','Front-end')} <span aria-hidden="true">⌄</span></button><div class="nav-dropdown" id="front-menu">${link('/front/etch',L('식각 공정','Etch process'))}${link('/front/deposition',L('증착 공정','Deposition process'))}</div></div>${link('/back',L('후공정','Back-end'))}${link('/products',L('제품','Products'))}${link('/contact',L('문의하기','Contact'))}<div class="mobile-actions">${auth.isLoggedIn()?`<button data-action="logout">${L('로그아웃','Log out')}</button>`:`<a href="#/login">${L('로그인','Log in')}</a><a href="#/signup">${L('회원가입','Sign up')}</a>`}</div></nav><div class="header-actions">${account}<button class="lang-switch" data-action="language" aria-label="${L('Switch to English','한국어로 전환')}">${lang==='ko'?'<strong>KO</strong><span> / EN</span>':'<span>KO / </span><strong>EN</strong>'}</button><button class="menu-toggle" data-action="menu" aria-expanded="false" aria-controls="primary-nav" aria-label="${L('전체 메뉴','Open menu')}">☰</button></div></div>`;
}
function renderFooter() {
  const c=data.company;
  footer.innerHTML=`<div class="container"><div class="footer-top"><div><a class="logo" href="#/" aria-label="SEMI LINK ${L('첫 화면','home')}">${logo()}</a><div class="footer-info"><div>Operated by ${esc(c.name)}</div><div>${L('대표','CEO')} ${esc(c.ceo)}</div><div class="footer-contact"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><a href="tel:${c.phone.replaceAll('-','')}">${esc(c.phone)}</a><a href="${esc(c.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div></div></div><div class="footer-links"><a href="#/privacy">${L('개인정보처리방침','Privacy policy')}</a><a href="#/terms">${L('이용약관','Terms of use')}</a></div></div><div class="footer-bottom"><span>© 2026 SEMI LINK. All rights reserved</span><span>${L('장비사명은 호환 장비를 안내하기 위해 표기했습니다','Equipment names identify compatible tools')}</span></div></div>`;
}
function pageHead(eyebrow,title,description,breadcrumb='') {
  return `<div class="page-head">${eyebrow.startsWith('ABOUT')||eyebrow==='PRODUCT PORTFOLIO'?`<img class="head-photo" data-optional-image src="assets/img/hero/${eyebrow.startsWith('ABOUT')?'hero-wafer':'hero-parts'}.webp" alt="" width="1920" height="800" loading="lazy">`:''}${breadcrumb?`<div class="breadcrumbs"><a href="#/">SEMI LINK</a><span>/</span><span>${breadcrumb}</span></div>`:''}<span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>`;
}
function processStrip(selected) {
 return `<div class="process-strip" aria-label="${L('반도체 8대 공정','Eight semiconductor processes')}">${data.processes.map(p=>{
 const content=`<span class="number">0${p.number}</span>${icon(p.id)}<span>${esc(loc(p.name))}</span>${!p.route?`<small>${L('준비 중','Coming soon')}</small><span class="hint">${L('공정 정보를 준비하고 있습니다','Process information is coming soon')}</span>`:''}`;
 return p.route?`<a class="process-item available ${selected===p.id?'selected':''}" href="${p.route}" ${selected===p.id?'aria-current="page"':''}>${content}</a>`:`<button type="button" class="process-item unavailable" aria-disabled="true" title="${L('공정 정보를 준비하고 있습니다','Process information is coming soon')}">${content}</button>`;
 }).join('')}</div>`;
}
function strengths() {
 return `<div class="stats">${data.company.strengths.map((s,i)=>`<div class="stat"><div class="stat-label">${esc(loc(s.label))}</div><div class="stat-value"><span data-counter="${i}" data-value="${s.value}">${s.value}</span><small>${esc(loc(s.unit))}</small></div><p>${esc(loc(s.description))}</p></div>`).join('')}</div><div class="support-note"><span>${L('샘플·소량 시험 주문 환영','Evaluation samples and trial orders welcome')}</span><span>${L('전 과정 이력 추적','Full process traceability')}</span></div>`;
}
function cta() {
 return `<div class="cta"><div><h2>${L('찾는 부품이 있으신가요?','Looking for a specific part?')}</h2><p>${L('품번이나 도면을 보내 주세요<br>적합한 공급원을 함께 찾습니다','Share your part number or drawing — Let’s find the right source')}</p></div>${button('#/contact',L('부품 상담 신청','Discuss your parts'),'outline')}</div>`;
}
function loginForm(context='page') {
 return `<form data-form="login" data-context="${context}"><div class="field"><label for="${context}-email">${L('업무 이메일(아이디)','Work email (ID)')}</label><input id="${context}-email" type="email" name="email" autocomplete="username" required placeholder="name@company.com" maxlength="254"></div><div class="field"><label for="${context}-password">${L('비밀번호','Password')}</label><input id="${context}-password" type="password" name="password" autocomplete="current-password" required maxlength="128" placeholder="${L('비밀번호를 입력해 주세요','Enter your password')}"></div><div class="form-error" role="alert" hidden></div><button class="btn primary block" type="submit">${L('로그인','Log in')}</button></form>`;
}
function home() {
 const facts=[['1018',L('개',''),L('등록 품번','Listed part numbers')],['8',L('개',''),L('소재 분류','Material families')],['30–40','%',L('OEM 대비 원가 절감','Lower cost vs — OEM')],['6',L('주',' wks'),L('한국 출고 납기','Lead time from Korea')]];
 const statement=L('8대 공정, 수천 개의 부품<br>이제 <em>챔버 안에서</em> 바로 찾으세요','Eight processes — Thousands of parts<br>Now find them <em>inside the chamber</em>.');
 const marquee=[...data.company.oems,'Silicon','SiC','Quartz','AlN','Al₂O₃','Y₂O₃','Sapphire','PEEK','Aluminum'];
 return `<section class="x-hero" data-x-hero>
  <video class="x-hero-media" autoplay muted loop playsinline preload="metadata" poster="assets/img/hero/hero-fab.webp" aria-hidden="true"><source src="assets/video/hero-cleanroom-960.mp4" type="video/mp4" media="(max-width: 760px)"><source src="assets/video/hero-cleanroom.mp4" type="video/mp4"></video>
  <div class="x-hero-shade"></div><canvas class="x-hero-grid" aria-hidden="true"></canvas>
  <div class="x-hero-inner">
   <span class="x-pill"><i></i>${L('반도체 부품 대체 공급원 플랫폼','2nd-source platform for semiconductor parts')}</span>
   <h1 class="x-hero-title"><span class="x-line">${L('반도체 공정 부품,','Every chamber part')}</span><span class="x-line"><b class="x-grad">${L('대체 공급원','Every 2nd source')}</b>${L('을 한 번에','')}</span></h1>
   <p class="x-hero-lead">${L('공정에서 챔버로, 부품에서 소재로, 그리고 공급사까지<br>SEMI LINK가 가장 빠른 길로 연결합니다','From process to chamber, part to material, and on to the supplier<br>SEMI LINK takes you there the fastest way')}</p>
   <div class="x-actions"><a class="x-btn x-btn-glow" href="#/front/etch">${L('챔버에서 부품 찾기','Explore the chamber')}<span aria-hidden="true">→</span></a><a class="x-btn x-btn-glass" href="#/signup">${L('무료 회원가입','Join for free')}</a></div>
  </div>
  <div class="x-hero-facts">${facts.map(([v,u,t],i)=>`<div><strong><span data-counter="h${i}" data-value="${v}">${v}</span><small>${u}</small></strong><span>${t}</span></div>`).join('')}</div>
  <a class="x-scroll" href="#x-statement" aria-label="${L('아래로','Scroll down')}"><span></span></a>
 </section>
 <div class="x-marquee" aria-hidden="true"><div class="x-marquee-track">${[0,1].map(()=>marquee.map(m=>`<span>${esc(m)}</span>`).join('<i>✦</i>')+'<i>✦</i>').join('')}</div></div>
 <section class="x-statement" id="x-statement"><p class="x-big rv">${statement}</p><div class="x-float rv"><img src="assets/img/visual/exploded-parts.webp" srcset="assets/img/visual/exploded-parts-960.webp 960w, assets/img/visual/exploded-parts.webp 1672w" sizes="(max-width:900px) 100vw, 1100px" alt="${L('식각 챔버 소모성 부품','Etch chamber consumable parts')}" width="1672" height="941" loading="lazy"></div></section>
 <section class="x-chamber-teaser">
  <div class="x-wrap">
   <div class="x-head rv"><span class="x-eyebrow">INTERACTIVE CHAMBER EXPLORER</span><h2>${L('챔버를 열어 보고,<br>부품을 눌러 보세요','Open the chamber<br>Tap any part')}</h2><p>${L('3D로 펼친 식각 챔버에서 부품을 고르면 쓸 수 있는 소재와 공급사가 차례로 열립니다','Pick a part in the 3D etch chamber to reveal its materials and suppliers, step by step')}</p></div>
   <div class="x-teaser-stage rv" data-teaser-3d><img src="assets/img/chamber/etch-cutaway.webp" srcset="assets/img/chamber/etch-cutaway-960.webp 960w, assets/img/chamber/etch-cutaway.webp 1672w" sizes="(max-width:900px) 100vw, 1200px" width="1672" height="941" alt="${L('식각 챔버 단면','Etch chamber cutaway')}" loading="lazy" data-optional-image><div class="x-teaser-cta"><a class="x-btn x-btn-glow" href="#/front/etch">${L('식각 챔버 탐색','Explore etch')}<span aria-hidden="true">→</span></a><a class="x-btn x-btn-glass" href="#/front/deposition">${L('증착 챔버 탐색','Explore deposition')}</a></div></div>
   <div class="x-flow rv">${[[L('부품','Part'),'Inner Electrode'],[L('소재','Material'),'Silicon · Quartz · SiC'],[L('공급사','Supplier'),'Supplier A · B · C'],[L('상세·연결','Connect'),L('회원 전용','Members only')]].map(([a,b],i)=>`<div style="--i:${i}"><span>0${i+1}</span><b>${a}</b><small>${b}</small></div>`).join('')}</div>
  </div>
 </section>
 <section class="x-section">
  <div class="x-wrap">
   <div class="x-head rv"><span class="x-eyebrow">8 PROCESSES</span><h2>${L('8대 공정에서 시작합니다','Start from eight processes')}</h2><p>${L('지금은 식각·증착 공정을 열어 두었고<br>다른 공정도 차례로 열립니다','Etch and deposition are live now — More processes are on the way')}</p></div>
   <div class="x-iso rv"><img src="assets/img/visual/iso-fab.webp" srcset="assets/img/visual/iso-fab-960.webp 960w, assets/img/visual/iso-fab.webp 1672w" sizes="(max-width:900px) 100vw, 1300px" alt="${L('반도체 8대 공정','Eight semiconductor processes')}" width="1672" height="941" loading="lazy"></div><div class="x-process rv">${data.processes.map((p,i)=>p.route?`<a class="x-proc live" href="${p.route}" style="--i:${i}"><span class="n">0${p.number}</span><span class="ic">${icon(p.id)}</span><b>${esc(loc(p.name))}</b><small>${L('탐색하기','Explore')} →</small></a>`:`<div class="x-proc" style="--i:${i}"><span class="n">0${p.number}</span><span class="ic">${icon(p.id)}</span><b>${esc(loc(p.name))}</b><small>${L('준비 중','Soon')}</small></div>`).join('')}</div>
  </div>
 </section>
 <section class="x-section x-dark">
  <video class="x-band-media" autoplay muted loop playsinline preload="none" poster="assets/img/hero/hero-wafer.webp" aria-hidden="true"><source src="assets/video/hero-wafer.mp4" type="video/mp4"></video>
  <div class="x-wrap">
   <div class="x-head rv"><span class="x-eyebrow">WHY SEMI LINK</span><h2>${L('OEM 수준의 품질,<br><span class="x-grad">더 빠르고 합리적으로</span>','OEM-grade quality<br><span class="x-grad">Faster — Smarter</span>')}</h2></div>
   <div class="x-stats rv">${data.company.strengths.map((s,i)=>`<div class="x-stat"><strong><span data-counter="${i}" data-value="${s.value}">${s.value}</span><small>${esc(loc(s.unit))}</small></strong><b>${esc(loc(s.label))}</b><p>${esc(loc(s.description))}</p></div>`).join('')}</div>
   <div class="x-chips rv"><span>${L('샘플·소량 시험 주문 환영','Samples & trial orders welcome')}</span><span>${L('전 과정 이력 추적','Full traceability')}</span><span>${L('아시아 주요 팹 공급 실적','Supplied to major Asian fabs')}</span></div>
  </div>
 </section>
 <section class="x-section">
  <div class="x-wrap">
   <div class="x-head rv"><span class="x-eyebrow">PRODUCT PORTFOLIO</span><h2>${L('소재별로 둘러보세요','Browse by material')}</h2><p>${L('회사소개서의 품번을 모두 옮겨 두었습니다<br>품번이나 장비명으로 바로 찾을 수 있습니다','Every part number from our catalog, searchable by part number or tool')}</p></div>
   <div class="x-bento rv">${data.categories.map((c,i)=>`<a class="x-tile ${i<2?'wide':''}" href="#/products/${c.id}" style="--i:${i}"><div class="x-tile-img">${c.images?.[0]?`<img src="${esc(c.images[0].src)}" alt="" loading="lazy" width="${c.images[0].width}" height="${c.images[0].height}">`:''}</div><div class="x-tile-txt"><small>${esc(c.material)}</small><b>${esc(c.name)}</b></div><span class="x-tile-go" aria-hidden="true">→</span></a>`).join('')}</div>
   <div class="x-oems rv"><span>${L('호환 장비','Compatible with')}</span>${data.company.oems.map(o=>`<b>${esc(o)}</b>`).join('')}</div>
  </div>
 </section>
 <section class="x-section x-join">
  <div class="x-wrap x-join-grid">
   <div class="x-join-copy rv"><span class="x-eyebrow">MEMBERS</span><h2>${L('공급사 상세 정보는<br>회원에게 열립니다','Supplier details<br>open to members')}</h2><p>${L('로그인하면 공급사 연락처와 견적 요청까지 이어집니다<br>찾는 품번이 있다면 바로 상담을 신청하세요','Sign in to reach supplier contacts and request quotes<br>Have a part number? Ask us directly')}</p><div class="x-actions"><a class="x-btn x-btn-dark" href="#/contact">${L('부품 상담 신청','Request a consultation')}<span aria-hidden="true">→</span></a></div></div>
   <div class="x-login rv">${auth.isLoggedIn()?`<h3>${L('환영합니다','Welcome back')}</h3><p>${L('챔버에서 부품을 찾아보세요','Explore parts in the chamber')}</p><a class="x-btn x-btn-glow" href="#/front/etch">${L('부품 찾기','Explore parts')}</a>`:`<h3>${L('로그인','Sign in')}</h3>${loginForm('hero')}<div class="login-foot"><span>${L('아직 회원이 아니신가요?','New to SEMI LINK?')}</span><a class="text-link" href="#/signup">${L('회원가입','Sign up')}</a></div>`}</div>
  </div>
 </section>`;
}
function companyPage() {
 const c=data.company;
 const proof=[['5,000',L('개 이상','+ pcs'),L('식각용 실리콘 부품 공급','Silicon etch parts supplied')],['1,018',L('개','')+'',L('호환 품번 카탈로그','Compatible part numbers')],['30–40','%',L('OEM 대비 원가 절감','Lower cost vs. OEM')],['5',L('영업일',' days'),L('공정 이슈 예비 분석·보고','Preliminary analysis & report')],['6',L('주',' wks'),L('한국 출고 납기(발주 후)','Shipping from Korea, ARO')]];
 const profile=[[L('회사명','Company'),`SEMILAB GLOBAL <span class="nb">Co., Ltd.</span>`],[L('대표','CEO'),esc(c.ceo)],[L('사업','Business'),L('반도체 소모성 부품 대체 공급원(2nd Source)<br><small>식각 공정 중심</small>','Alternative (2nd source) consumable parts<br><small>Especially for etch</small>')],[L('호환 장비','Compatible with'),'Lam Research · TEL · AMAT · AMEC · NAURA · Novellus'],[L('취급 품목','Items'),'Silicon · SiC · Quartz · Ceramic · Gasket · Machining · Heater · ESC · Metal(Al, Al+Y₂O₃) · Chamber Liner']];
 const pillars=[[L('유연한 맞춤 지원','Flexible support'),[L('평가용 샘플·소량 시험 주문 환영','Evaluation samples & trial orders welcome')]],[L('검증된 품질·빠른 대응','Proven quality, fast response'),[L('아시아 주요 반도체 팹 공급 실적','Supplied to major Asian fabs'),L('5영업일 안에 예비 분석·보고','Preliminary report in 5 working days'),L('전 과정 이력 추적','Full traceability')]],[L('원가 절감·짧은 납기','Lower cost, shorter lead time'),[L('OEM과 동등한 품질, 30–40% 낮은 원가','OEM-equivalent quality at 30–40% lower cost'),L('한국 출고, 발주 후 6주 이내','Ships from Korea within 6 weeks ARO')]]];
 const flow=[L('원자재 입고 검사','Incoming inspection'),L('초정밀 가공','Precision machining'),L('표면 가공·래핑','Lapping'),L('용접','Welding'),L('파이어 폴리싱','Fire polishing'),L('어닐링','Annealing'),L('세정·에칭','Cleaning & etching'),L('출하 검사','Outgoing inspection'),L('포장·출하','Packing & shipment')];
 return `${pageHead('ABOUT SEMILAB GLOBAL',L('OEM 수준 품질의<br>두 번째 공급원','A second source<br>with OEM-grade quality'),L('식각·증착 소모성 부품을 더 합리적인 원가와 짧은 납기로 공급합니다','Etch and deposition consumables at lower cost and shorter lead time'),L('회사소개','Company'))}
 <section class="x-proof"><div class="x-wrap"><div class="x-proof-row rv">${proof.map(([v,u,t],i)=>`<div style="--i:${i}"><strong><span data-counter="p${i}" data-value="${v.replace(',','')}">${v}</span><small>${u}</small></strong><span>${t}</span></div>`).join('')}</div></div></section>
 <section class="x-section x-tight"><div class="x-wrap"><div class="x-profile rv">
  <div class="x-profile-lead"><span class="x-eyebrow">COMPANY PROFILE</span><h2>${L('검증된 대체 부품으로<br>팹의 원가와 납기를 바꿉니다','Qualified alternatives that change<br>your cost and lead time')}</h2><p>${esc(loc(c.business))}</p><a class="x-btn x-btn-dark" href="#/contact">${L('부품 상담 신청','Request a consultation')}<span aria-hidden="true">→</span></a></div>
  <dl class="x-profile-list">${profile.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
 </div></div></section>
 <section class="x-section x-soft"><div class="x-wrap">
  <div class="x-head rv"><span class="x-eyebrow">PROVEN QUALITY</span><h2>${L('품질은 확대해 보면<br>차이가 납니다','Quality shows<br>under the microscope')}</h2><p>${L('같은 부품을 확대해 비교한 실제 사진입니다','Actual magnified photos of the same parts')}</p></div>
  <div class="x-compare rv">
   <article><h3>${L('슬롯 표면','Slot surface')}<small>C-Shroud Ring</small></h3><div class="x-pair"><figure class="bad"><img src="assets/img/company/slot-competitor.webp" alt="${L('타사 슬롯 표면 확대 사진, 균열이 보임','Competitor slot surface with cracks')}" loading="lazy"><figcaption>${L('타사','Competitor')}<em>${L('균열','Crack')}</em></figcaption></figure><figure class="good"><img src="assets/img/company/slot-semilab.webp" alt="${L('SEMILAB GLOBAL 슬롯 표면 확대 사진, 매끈함','SEMILAB GLOBAL slot surface, smooth')}" loading="lazy"><figcaption>SEMILAB GLOBAL<em>${L('매끈한 표면','Smooth')}</em></figcaption></figure></div></article>
   <article><h3>${L('가스 홀','Gas hole')}<small>Electrode</small></h3><div class="x-pair"><figure class="bad"><img src="assets/img/company/hole-competitor.webp" alt="${L('타사 가스 홀 확대 사진, 가장자리 손상','Competitor gas hole with edge damage')}" loading="lazy"><figcaption>${L('타사','Competitor')}<em>${L('가장자리 손상','Hole damage')}</em></figcaption></figure><figure class="good"><img src="assets/img/company/hole-semilab.webp" alt="${L('SEMILAB GLOBAL 가스 홀 확대 사진, 깨짐 없음','SEMILAB GLOBAL gas hole, no chipping')}" loading="lazy"><figcaption>SEMILAB GLOBAL<em>${L('깨짐 없음','No chipping')}</em></figcaption></figure></div></article>
  </div>
  <div class="x-qtags rv"><span>${L('홀 크기 편차 감소','Less hole-size deviation')}</span><span>${L('진원도 향상','Better roundness')}</span><span>${L('위치 정밀도','Position accuracy')}</span><span>${L('LAM 곡면 형상 비교 데이터','LAM curved-shape comparison data')}</span></div>
  <p class="x-src rv">${L('사진·항목 출처: SEMILAB GLOBAL 회사소개서','Source: SEMILAB GLOBAL company introduction')}</p>
 </div></section>
 <section class="x-section"><div class="x-wrap">
  <div class="x-head rv"><span class="x-eyebrow">TECHNICAL CAPABILITIES</span><h2>${L('자동화 설비와 OEM 기준<br>품질 관리','Automated production<br>under OEM-standard QC')}</h2><p>${L('석영 부품은 원자재(수입) 입고부터 출하까지 전 공정을 자체에서 수행합니다','Quartz parts go through every step in-house, from imported raw material to shipment')}</p></div>
  <div class="x-factory rv"><figure class="big"><img src="assets/img/company/fire-welding.webp" alt="${L('석영 부품 용접 공정','Quartz welding')}" loading="lazy"><figcaption>${L('석영 용접','Quartz welding')}</figcaption></figure><figure><img src="assets/img/company/auto-1.webp" alt="${L('자동화 가공 설비','Automated machining')}" loading="lazy"><figcaption>${L('자동화 가공','Automated machining')}</figcaption></figure><figure><img src="assets/img/company/robot.webp" alt="${L('로봇 가공 셀','Robotic cell')}" loading="lazy"><figcaption>${L('로봇 가공 셀','Robotic cell')}</figcaption></figure><figure><img src="assets/img/company/auto-2.webp" alt="${L('석영 링 가공','Quartz ring machining')}" loading="lazy"><figcaption>${L('석영 링 가공','Quartz ring machining')}</figcaption></figure></div>
  <ol class="x-flow9 rv">${flow.map((f,i)=>`<li style="--i:${i}"><span>${String(i+1).padStart(2,'0')}</span>${f}</li>`).join('')}</ol>
 </div></section>
 <section class="x-section x-dark">
  <video class="x-band-media" autoplay muted loop playsinline preload="none" poster="assets/img/hero/hero-wafer.webp" aria-hidden="true"><source src="assets/video/hero-wafer.mp4" type="video/mp4"></video>
  <div class="x-wrap"><div class="x-head rv"><span class="x-eyebrow">WHY PARTNER WITH US</span><h2>${L('함께할 수 있는 세 가지 이유','Three reasons to partner')}</h2></div>
  <div class="x-pillars rv">${pillars.map(([t,items],i)=>`<article style="--i:${i}"><span>0${i+1}</span><h3>${t}</h3><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></article>`).join('')}</div></div>
 </section>
 <section class="x-section x-soft"><div class="x-wrap x-contact-grid">
  <div class="x-head x-head-left rv"><span class="x-eyebrow">CONTACT</span><h2>${L('품번 하나로<br>상담을 시작하세요','Start with<br>a single part number')}</h2><p>${L('도면이나 품번을 보내 주시면 5영업일 안에 예비 분석을 드립니다','Send a drawing or part number for a preliminary analysis within 5 working days')}</p></div>
  <div class="x-contact rv"><a href="mailto:${c.email}"><small>${L('이메일','Email')}</small><b>${esc(c.email)}</b></a><a href="tel:${c.phone.replaceAll('-','')}"><small>${L('전화','Phone')}</small><b>${c.phone}</b></a><a href="${c.linkedin}" target="_blank" rel="noopener noreferrer"><small>LinkedIn</small><b>Theo Jeon ↗</b></a><a class="x-contact-go" href="#/contact"><small>${L('온라인','Online')}</small><b>${L('부품 상담 신청','Request a consultation')} →</b></a></div>
 </div></section>`;
}
function productsPage() {
 return `${pageHead('PRODUCT PORTFOLIO',L('공정에 필요한 부품, 한곳에','Components for your process'),L('소재와 품목별로 살펴보고, 품번으로 빠르게 찾아보세요','Browse by material and category, or find a specific part number'),L('제품','Products'))}
 <section class="x-section x-tight"><div class="x-wrap">
  <div class="x-gsearch rv"><label>${icon('search')}<span class="sr-only">${L('전체 품번 검색','Search all part numbers')}</span><input id="global-search" type="search" autocomplete="off" maxlength="100" placeholder="${L('품번·장비명·부품명으로 전체 검색 (예: 716-, Kiyo, ESC)','Search every part number, tool or name (e.g. 716-, Kiyo, ESC)')}"></label><p id="global-meta">${L('8개 분류의 전체 품번을 한 번에 찾습니다','Search across all eight categories at once')}</p><div id="global-results" aria-live="polite"></div></div>
 </div></section>
 <section class="x-section x-tight-top"><div class="x-wrap"><div class="x-head rv"><span class="x-eyebrow">8 CATEGORIES</span><h2>${L('소재별로 둘러보세요','Browse by material')}</h2></div>
  <div class="x-bento x-bento-full rv">${data.categories.map((c,i)=>`<a class="x-tile ${i<2?'wide':''}" href="#/products/${c.id}" style="--i:${i}"><div class="x-tile-img">${c.images?.[0]?`<img src="${esc(c.images[0].src)}" alt="" loading="lazy" width="${c.images[0].width}" height="${c.images[0].height}">`:''}</div><div class="x-tile-txt"><small>${esc(c.material)}</small><b>${esc(c.name)}</b><em data-cat-count="${c.id}"></em></div><span class="x-tile-go" aria-hidden="true">→</span></a>`).join('')}</div>
  <div class="x-oems rv"><span>${L('호환 장비','Compatible with')}</span>${data.company.oems.map(o=>`<b>${esc(o)}</b>`).join('')}</div></div></section>
 <section class="x-section x-soft"><div class="x-wrap">${cta()}</div></section>`;
}
async function bindProducts() {
 const counts=document.querySelectorAll('[data-cat-count]');
 const input=document.querySelector('#global-search');
 if(!counts.length&&!input)return;
 const all=await Promise.all(data.categories.map(c=>getJSON(`data/products/${c.id}.json`).then(rows=>rows.map(r=>({...r,cat:c})))));
 counts.forEach(el=>{const n=all[data.categories.findIndex(c=>c.id===el.dataset.catCount)]?.length;if(n)el.textContent=`${n.toLocaleString()} ${L('품번','part numbers')}`;});
 if(!input)return;
 const flat=all.flat(),out=document.querySelector('#global-results'),meta=document.querySelector('#global-meta');
 meta.textContent=L(`8개 분류, 전체 ${flat.length.toLocaleString()}개 품번을 한 번에 찾습니다`,`Search ${flat.length.toLocaleString()} part numbers across eight categories`);
 let t;input.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{
  const q=input.value.trim().toLowerCase();
  if(q.length<2){out.innerHTML='';out.classList.remove('on');return;}
  const hits=flat.filter(r=>[r.partNo,r.description,r.tool,r.oem].some(v=>String(v||'').toLowerCase().includes(q)));
  out.classList.add('on');
  out.innerHTML=hits.length?`<div class="x-gs-head">${L(`${hits.length.toLocaleString()}개 찾음`,`${hits.length.toLocaleString()} matches`)}${hits.length>12?` · ${L('앞 12개 표시','showing 12')}`:''}</div>${hits.slice(0,12).map(r=>`<div class="x-gs-row"><span class="x-gs-cat">${esc(r.cat.name)}</span><b>${esc(r.partNo)}</b><span class="x-gs-desc">${esc(r.description)||'—'}</span><span class="x-gs-tool">${esc(r.oem)||''}${r.tool?` · ${esc(r.tool)}`:''}</span><a class="x-gs-go" href="#/contact?part=${encodeURIComponent(r.partNo)}">${L('견적 문의','Get quote')}</a></div>`).join('')}`:`<div class="x-gs-empty">${L('찾는 품번이 없습니다 — 품번을 보내 주시면 공급원을 찾아 드립니다','No match — Send us the part number and we will source it')} <a href="#/contact?part=${encodeURIComponent(input.value.trim())}">${L('상담 신청','Ask us')} →</a></div>`;
 },160);});
}
function technicalSpecs(id) {
 const specs=(data.technicalSpecs||[]).filter(s=>s.category===id);
 if(!specs.length)return '';
 return `<details class="technical-specs"><summary>${L('소재별 기술 사양 보기','View material specifications')}</summary><div class="spec-grid">${specs.map(spec=>`<article><h3>${esc(spec.name)}</h3><div class="table-scroll" tabindex="0" role="region" aria-label="${esc(spec.name)}"><table><caption>${esc(spec.name)}</caption><thead><tr>${spec.headers.map(h=>`<th scope="col">${esc(h)||'—'}</th>`).join('')}</tr></thead><tbody>${spec.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></article>`).join('')}</div></details>`;
}
async function categoryPage(id) {
 const cat=data.categories.find(c=>c.id===id);
 if (!cat) return notFound();
 const rows=await getJSON(`data/products/${id}.json`);
 return {html:`${pageHead('PRODUCT PORTFOLIO',esc(cat.name),esc(loc(cat.description)),L('제품','Products'))}<section class="section container"><nav class="category-tabs" aria-label="${L('제품 분류','Product categories')}">${data.categories.map(c=>`<a href="#/products/${c.id}" ${id===c.id?'class="current" aria-current="page"':''}>${esc(c.name)}</a>`).join('')}</nav><div class="product-detail-top"><div class="product-gallery">${cat.images.map(i=>`<figure>${photo(i,cat.name)}</figure>`).join('')}</div><div><span class="eyebrow">${esc(cat.material)}</span><h2>${esc(loc(cat.description))}</h2><ul class="feature-list">${loc(cat.features).map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${button(`#/contact?part=${encodeURIComponent(cat.name)}`,L('이 품목 문의하기','Ask about these parts'),'outline')}</div></div>${technicalSpecs(id)}</section><section class="section soft"><div class="container"><div class="catalog-heading"><h2>${L('공급 품번 목록','Available part numbers')}</h2><span>${L('품번·장비명으로 검색하세요','Search by part number or tool')}</span></div><div class="catalog-controls"><label class="search-field">${icon('search')}<span class="sr-only">${L('품번·장비명 검색','Search part numbers or tools')}</span><input id="product-search" type="search" placeholder="${L('품번 또는 장비명을 입력해 주세요','Enter a part number or tool name')}" maxlength="100"></label><select id="oem-filter" aria-label="${L('장비 제조사 필터','Filter by OEM')}"><option value="">${L('모든 장비사','All OEMs')}</option>${[...new Set(rows.map(r=>r.oem))].sort().map(o=>`<option>${esc(o)}</option>`).join('')}</select><select id="size-filter" aria-label="${L('크기 필터','Filter by size')}"><option value="">${L('모든 크기','All sizes')}</option>${[...new Set(rows.flatMap(r=>r.variants.map(v=>v.size)).filter(s=>/^\d+ INCH$/.test(s)))].sort((a,b)=>parseInt(a)-parseInt(b)).map(s=>`<option value="${s}">${s.replace(' INCH',L('인치',' inch'))}</option>`).join('')}</select></div><div id="catalog-results" aria-live="polite"></div><p class="catalog-note">${L('같은 품번의 설명·장비·규격이 여러 개이면 함께 표시합니다<br>원자료에 없는 정보는 ‘—’로 표시하고, 호환 여부와 공급 조건은 상담 때 안내합니다','Multiple descriptions, tools and sizes for the same part number are shown together — A dash indicates information absent from the source — Compatibility and supply terms are discussed during consultation')}</p></div></section>`, rows, cat};
}
function renderCatalog() {
 const filtered=filterProducts(catalogRows,catalogState);
 const page=paginate(filtered,catalogState.page);catalogState.page=page.page;
 const node=document.querySelector('#catalog-results');if(!node)return;
 node.innerHTML=`<div class="catalog-heading"><span>${L('총','Total')} <strong>${page.total.toLocaleString()}</strong>${L('개 품번',' part numbers')}</span><span>${page.page} / ${page.pages}</span></div><div class="table-scroll" role="region" tabindex="0" aria-label="${L('품번 목록, 가로로 스크롤할 수 있음','Part number table — Scroll horizontally to view all columns')}"><table><caption>${esc(currentCategory.name)} ${L('공급 품번','available part numbers')}</caption><thead><tr><th scope="col">OEM</th><th scope="col">Part No</th><th scope="col">Description</th><th scope="col">Tool</th><th scope="col">${L('규격','Size')}</th><th scope="col"><span class="sr-only">${L('견적 문의','Request quote')}</span></th></tr></thead><tbody>${page.rows.map(r=>`<tr><td>${esc(r.oem)||'—'}</td><td class="part-no">${esc(r.partNo)}</td><td><span class="variant">${esc(r.description)||'—'}</span></td><td>${esc(r.tool)||'—'}</td><td>${esc(r.size)||'—'}</td><td><a class="btn small outline" href="#/contact?part=${encodeURIComponent(r.partNo)}" aria-label="${esc(r.partNo)} ${L('견적 문의','request quote')}">${L('견적 문의','Get quote')}</a></td></tr>`).join('')||`<tr><td colspan="6" class="empty-state">${L('검색 결과가 없습니다 — 다른 품번이나 장비명으로 검색해 주세요','No matches — Try another part number or tool name')}</td></tr>`}</tbody></table></div><nav class="pagination" aria-label="${L('품번 목록 페이지','Part list pages')}"><button data-page="${page.page-1}" ${page.page===1?'disabled':''} aria-label="${L('이전 페이지','Previous page')}">←</button>${Array.from({length:page.pages},(_,i)=>i+1).filter(n=>n===1||n===page.pages||Math.abs(n-page.page)<=2).map((n,i,list)=>`${i&&n-list[i-1]>1?'<span>…</span>':''}<button data-page="${n}" ${n===page.page?'aria-current="page"':''} aria-label="${n}${L('쪽',' page')}">${n}</button>`).join('')}<button data-page="${page.page+1}" ${page.page===page.pages?'disabled':''} aria-label="${L('다음 페이지','Next page')}">→</button></nav>`;
}
function chamberPage(id) {
 const ch=data.chambers[id];activeChamber=ch;explorer={part:null,material:null,supplier:null};
 return `${pageHead(id==='etch'?'ETCH PROCESS':'DEPOSITION PROCESS',L('챔버에서 시작하는 부품 탐색','Explore parts inside the chamber'),L('부품을 선택하고, 소재와 공급사를 차례로 살펴보세요','Choose a component, then explore its materials and suppliers'),L('전공정','Front-end'))}<section class="container chamber-section">${processStrip(id)}<div class="chamber-toolbar"><div><h2>${esc(loc(ch.name))} <span class="small">${id==='etch'?'Etch':'CVD / ALD'}</span></h2></div>${data.suppliers.sample?`<span class="badge">${L('예시 데이터','Sample data')}</span>`:''}</div><div class="chamber-workspace"><div class="diagram-card"><div class="c3d-bar"><div class="c3d-seg" role="group" aria-label="${L('보기 방식','View mode')}"><button data-c3d-mode="3d" aria-pressed="true">3D</button><button data-c3d-mode="2d" aria-pressed="false">${L('단면도','Section')}</button></div><div class="c3d-tools"><button data-c3d-explode aria-pressed="false">${L('층 펼치기','Explode')}</button><button data-c3d-full aria-pressed="false">${L('전체 형상','Full body')}</button><button data-c3d-reset>${L('처음으로','Reset')}</button></div></div><div class="diagram-label" data-t3d="${ch.subtitle} · ${L('끌어서 돌리고, 부품을 누르세요','Drag to rotate · tap a part')}">${ch.subtitle} · ${L('끌어서 돌리고, 부품을 누르세요','Drag to rotate · tap a part')}</div><div class="c3d" data-c3d="${id}"><div class="c3d-loading"><span></span>${L('3D 챔버를 불러오고 있습니다','Loading 3D chamber')}</div></div><div class="c2d" hidden><div class="diagram-preview" role="status"></div>${chamberSVG(ch,data.materials,lang)}</div><div class="legend">${ch.legend.map(g=>`<span><i class="dot ${g.color}"></i>${esc(g.label)}</span>`).join('')}</div><p class="diagram-hint">${L('색 점이나 부품을 누르면 사용 가능한 소재가 열립니다','Select a colored dot or component to explore available materials')}</p><div class="part-picker" aria-label="${L('부품 목록에서 선택','Select a component from the list')}">${ch.parts.filter((p,i,a)=>p.materials.length&&a.findIndex(o=>o.name===p.name)===i).map(p=>`<button data-select-part="${p.id}">${esc(p.name)}</button>`).join('')}</div></div><button class="sheet-scrim" data-action="close-explorer" tabindex="-1" aria-label="${L('부품 탐색 닫기','Close part explorer')}"></button><div class="explorer-stage" id="explorer-stage"><div class="explorer-empty">${icon('link')}<span class="eyebrow">YOUR NEXT SOURCE STARTS HERE</span><h3>${L('부품 하나에서<br>새로운 연결로','One component<br>A new connection')}</h3><p>${L('구조도에서 필요한 부품을 고르면<br>그 부품에 맞는 소재와 공급사를 보여 드립니다','Select a component in the diagram to discover its available materials and suppliers')}</p><div class="explorer-steps"><span>01 ${L('부품','Part')}</span>→<span>02 ${L('소재','Material')}</span>→<span>03 ${L('공급사','Supplier')}</span></div></div></div></div><div class="usage-guide" aria-label="${L('이용 안내','How to use')}">${[[L('① 공정 선택','① Process'),L('8대 공정에서 식각 또는 증착을 선택하세요','Choose etch or deposition from the process strip')],[L('② 부품 선택','② Component'),L('구조도에서 부품을 누르세요 · 색 점은 소재 종류','Select a component — Colored dots identify material families')],[L('③ 소재 확인','③ Material'),L('선택한 부품에 사용할 수 있는 소재를 살펴보세요','Explore materials available for that component')],[L('④ 공급사 확인','④ Supplier'),L('소재를 선택하면 공급사 목록이 열립니다','Choose a material to view supplier options')],[L('⑤ 상세·연결','⑤ Connect'),L('공급사 정보를 살펴보고 상세 안내를 받아보세요','Review the supplier and continue to more details')]].map(([a,b])=>`<div><b>${a}</b><p>${b}</p></div>`).join('')}</div></section>`;
}
function selectedPart() { return activeChamber?.parts.find(p=>p.id===explorer.part); }
function panelHead(level,title) {return `<div class="panel-head"><div><small>0${level} / ${level===1?'MATERIAL':level===2?'SUPPLIER':'DETAIL'}</small><h3 id="panel-title-${level}">${esc(title)}</h3></div><button class="icon-button" data-action="close-explorer" aria-label="${L('닫기','Close')}">×</button></div>`;}
async function renderPanels(focus=true) {
 const stage=document.querySelector('#explorer-stage');if(!stage)return;
 const part=selectedPart();if(!part)return;
 const currentState={...explorer};
 const mats=part.materials.map(id=>data.materials.find(m=>m.id===id)).filter(Boolean);
 const mat=mats.find(m=>m.id===explorer.material);
 const supplier=data.suppliers.suppliers.find(s=>s.id===explorer.supplier);
 const supplierList=mat?data.suppliers.suppliers.filter(s=>s.materials.includes(mat.id)):[];
 let html=`<section class="explorer-panel level-1" role="dialog" aria-labelledby="panel-title-1">${panelHead(1,L('사용 가능한 소재','Available materials'))}<div class="panel-body"><p class="panel-context">${esc(part.name)}</p>${mats.map(m=>`<button class="material-option" data-material="${m.id}" aria-pressed="${m.id===explorer.material}"><i class="dot ${m.color}"></i>${esc(m.name)}<span class="arrow" aria-hidden="true">→</span></button>`).join('')}</div></section>`;
 if(mat) html+=`<section class="explorer-panel level-2" role="dialog" aria-labelledby="panel-title-2">${panelHead(2,L(`${mat.name} 공급사`,`Suppliers · ${mat.name}`))}<div class="panel-body"><button class="panel-back" data-back="1">← ${L('소재 다시 선택','Back to materials')}</button>${supplierList.map(s=>`<button class="supplier-option" data-supplier="${s.id}" aria-pressed="${s.id===explorer.supplier}"><span>${esc(s.name)}<small>${L('가능 부품 수','Available parts')} ${s.availableParts}ea</small><small>Supplying to '${s.customers[0]}' Company</small></span><span class="arrow" aria-hidden="true">→</span></button>`).join('')||`<p>${L('이 소재의 공급사 정보는 상담으로 안내합니다','Contact us for suppliers of this material')}</p>`}</div></section>`;
 if(mat&&supplier&&supplierList.includes(supplier)) {
  const category=mat.id==='sapphire'&&part.name==='Lift Pins'?'ceramic':mat.category;
  const sourceRows=await getJSON(`data/products/${category}.json`);
  const materialNames={aln:'AlN',alumina:'Al2O3',sapphire:'Sapphire',silicon:'Silicon',quartz:'Quartz'};
  const materialRows=materialNames[mat.id]?sourceRows.filter(r=>r.material.includes(materialNames[mat.id])):sourceRows;
  const rows=materialRows.length?materialRows:sourceRows;
  if(!document.contains(stage)||Object.keys(currentState).some(k=>currentState[k]!==explorer[k]))return;
  const needles={choke:'plate', 'inner-electrode':'inner', 'inner-heater':'heater', esc:'ESC',showerhead:'SHOWER',faceplate:'FACE',isolator:'ISOLATOR','aln-heater':'AlN Heater','carrier-left':'CARRIER','carrier-right':'CARRIER','lift-left':'PIN','lift-right':'PIN',gasket:'Gasket'};
  const term=needles[part.id]|| (part.name.includes('Shroud')?'Shroud':part.name.includes('Electrode')?'Electrode':part.name.includes('Edge')?'Edge':part.name.includes('Liner')?'LINER':'');
  let examples=rows.filter(r=>!term||r.description.toLowerCase().includes(term.toLowerCase()));
  // These are real catalog references, not verified supplier inventory — Suppliers are sample data.
  if(!examples.length) examples=rows;
  html+=`<section class="explorer-panel level-3" role="dialog" aria-labelledby="panel-title-3">${panelHead(3,L(`공급사 ${supplier.id}`,`Supplier ${supplier.id}`))}<div class="panel-body"><button class="panel-back" data-back="2">← ${L('공급사 다시 선택','Back to suppliers')}</button><dl class="supplier-facts"><div><dt>${L('설립','Established')}</dt><dd>${esc(supplier.establishment)}</dd></div><div><dt>${L('위치','Location')}</dt><dd>${esc(supplier.location)}</dd></div><div><dt>${L('가능 부품 수','Available parts')}</dt><dd>${supplier.availableParts}ea</dd></div><div><dt>${L('주요 고객','Key customers')}</dt><dd>${supplier.customers.map(esc).join(', ')}</dd></div></dl><p class="panel-context">${L('카탈로그 품번 예시','Catalog part number examples')}</p><ul class="part-examples">${examples.slice(0,5).map(r=>`<li>${esc(r.oem)} · ${esc(r.partNo)}</li>`).join('')}</ul><button class="btn primary block" data-action="more-detail">${L('상세 정보·견적 요청','More detail')} ${arrow}</button></div></section>`;
 }
 const trail=[[L('부품','Part'),part.name,''],[L('소재','Material'),mat?.name,'1'],[L('공급사','Supplier'),supplier&&mat?supplier.id:null,'2']];
 html=`<ol class="x-trail" aria-label="${L('탐색 단계','Steps')}">${trail.map(([k,v,b],i)=>`<li class="${v?'done':''} ${i===(supplier&&mat?2:mat?1:0)?'now':''}">${v&&b?`<button data-back="${b}">`:'<span>'}<small>0${i+1} ${k}</small><b>${v?esc(v):L('선택 전','—')}</b>${v&&b?'</button>':'</span>'}</li>`).join('')}</ol>`+html;
 stage.innerHTML=html;noOrphans(stage);
 document.querySelector('.chamber-workspace')?.classList.add('has-selection');
 document.querySelectorAll('[data-part], [data-select-part]').forEach(el=>el.classList.toggle('active',(el.dataset.part||el.dataset.selectPart)===part.id));
 const panels=stage.querySelectorAll('.explorer-panel');
 if(!window.matchMedia('(max-width: 1000px)').matches) stage.style.minHeight=`${Math.max(690,...[...panels].map(panel=>panel.offsetTop+panel.offsetHeight+24))}px`;
 if(window.matchMedia('(max-width: 1000px)').matches) panels[panels.length-1]?.setAttribute('aria-modal','true');
 if(focus) panels[panels.length-1]?.querySelector('.material-option,.supplier-option,.btn,.icon-button')?.focus({preventScroll:true});
}
function closeExplorer() {
 const id=explorer.part;
 explorer={part:null,material:null,supplier:null};
 document.querySelector('.chamber-workspace')?.classList.remove('has-selection');
 document.querySelectorAll('[data-part], [data-select-part]').forEach(el=>el.classList.remove('active'));
 const stage=document.querySelector('#explorer-stage');
 if(stage) stage.style.minHeight='';
 if(stage) stage.innerHTML=`<div class="explorer-empty">${icon('link')}<span class="eyebrow">YOUR NEXT SOURCE STARTS HERE</span><h3>${L('다음 부품을 살펴보세요','Explore your next component')}</h3><p>${L('구조도에서 부품을 선택하면 소재와 공급사를 보여 드립니다','Select a component to explore its materials and suppliers')}</p></div>`;
 document.querySelector(`[data-part="${id}"]`)?.focus({preventScroll:true});
}
function backPage() {
 return `${pageHead('BACK-END PROCESSES',L('공정의 마지막까지 이어지는 연결','Connections through the final process'),L('테스트·패키징 부품 정보를 준비하고 있습니다','Information on test and packaging components is on its way'),L('후공정','Back-end'))}<section class="section container"><div class="future-grid">${[['test',L('테스트 공정','Test process'),L('웨이퍼·칩 테스트에 필요한 부품을 소개할 예정입니다','Explore components for wafer and chip testing here soon')],['package',L('패키징 공정','Packaging process'),L('패키징 공정 부품을 소개할 예정입니다','Explore packaging process components here soon')]].map(([i,t,p])=>`<article class="future-card"><div class="step-icon">${icon(i)}</div><span class="badge">${L('준비 중','Coming soon')}</span><h3>${t}</h3><p>${p}</p></article>`).join('')}</div></section><section class="section container">${cta()}</section>`;
}
const field=(name,label,type='text',required=false,value='',placeholder='')=>`<div class="field"><label for="contact-${name}">${label}${required?'<span class="required" aria-hidden="true">*</span>':''}</label><input id="contact-${name}" name="${name}" type="${type}" ${required?'required':''} ${name==='quantity'?'min="1" step="1"':''} value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="${type==='email'?254:200}" ${['email','name','phone','company'].includes(name)?`autocomplete="${{email:'email',name:'name',phone:'tel',company:'organization'}[name]}"`:''}></div>`;
function contactPage(params) {
 const c=data.company;
 const req=`<span class="required" aria-hidden="true">*</span><span class="sr-only">${L('필수','required')}</span>`;
 const f=(n,name,ko,en,type,required,ph='')=>`<div class="x-field"><label for="ct-${name}"><i>${n}</i>${L(ko,en)}${required?req:`<em>${L('선택','Optional')}</em>`}</label><input id="ct-${name}" name="${name}" type="${type}" ${required?'required':''} maxlength="200" placeholder="${ph}" ${type==='email'?'autocomplete="email"':type==='tel'?'autocomplete="tel"':''}></div>`;
 const pre=params.get('part')?L(`품번 ${params.get('part')} 문의드립니다\n`,`Inquiry about part ${params.get('part')}.\n`):'';
 return `${pageHead('LET’S CONNECT',L('필요한 부품을 알려 주세요','Tell us what you need'),L('문의를 확인한 뒤 빠르게 연락드립니다<br>문의는 담당자에게 자동으로 전달됩니다','We will contact you shortly after checking your inquiry — It reaches the manager automatically'),L('문의하기','Contact'))}
 <section class="x-section x-tight"><div class="x-wrap x-contact-wrap">
  <aside class="x-contact-side rv"><span class="x-eyebrow">PARTS & SOURCING</span><h2>${L('적합한 공급원을<br>함께 찾습니다','Let’s find your<br>next source')}</h2><p>${L('샘플·소량 시험 주문도 상담할 수 있습니다','Evaluation samples and small trial orders are welcome')}</p>
   <ul><li><small>${L('이메일','Email')}</small><a href="mailto:${c.email}">${c.email}</a></li><li><small>${L('전화','Phone')}</small><a href="tel:${c.phone.replaceAll('-','')}">${c.phone}</a></li><li><small>${L('담당자','Contact')}</small><span>Theo Jeon · SEMILAB GLOBAL</span></li></ul></aside>
  <form class="x-form rv" data-form="contact" novalidate>
   <p class="x-form-note">${L('<b>*</b> 표시는 꼭 적어 주셔야 문의가 접수됩니다','Fields marked <b>*</b> are required')}</p>
   <fieldset class="x-field x-type"><legend><i>1</i>${L('구분','User / Distributor / Manufacturer')}${req}</legend><div>${[['User',L('사용처 · User','User')],['Distributor',L('유통사 · Distributor','Distributor')],['Manufacturer',L('제조사 · Manufacturer','Manufacturer')]].map(([v,t])=>`<label><input type="radio" name="type" value="${v}" required><span>${t}</span></label>`).join('')}</div></fieldset>
   <div class="x-form-grid">
    ${f(2,'company','회사명','Company name','text',true)}
    ${f(3,'location','사업장 위치','Business location','text',true,L('예: 경기도 용인시','e.g — Yongin, Korea'))}
    ${f(4,'regno','사업자등록번호','Business registration number','text',false,'000-00-00000')}
    ${f(5,'name','담당자 이름','Contact person','text',true)}
    ${f(6,'mobile','휴대전화','Mobile','tel',false,'010-0000-0000')}
    ${f(7,'email','이메일','Email','email',true,'name@company.com')}
   </div>
   <div class="x-field"><label for="ct-message"><i>8</i>${L('문의 내용','Inquiry')}${req}</label><textarea id="ct-message" name="message" required maxlength="6000" placeholder="${L('사용 장비, 공정, 필요한 부품·품번·수량을 알려 주세요','Tool, process, part numbers and quantity')}">${esc(pre)}</textarea></div>
   <input type="text" name="_honey" tabindex="-1" autocomplete="off" class="x-honey" aria-hidden="true">
   <label class="x-consent"><input type="checkbox" name="privacy" required><span>${L('상담을 위한 개인정보 수집·이용에 동의합니다','I consent to the use of my information for this inquiry')}${req} <a href="#/privacy" target="_blank" rel="noopener">${L('자세히','Details')}</a></span></label>
   <div class="form-error" role="alert" hidden></div>
   <button class="x-btn x-btn-glow x-send" type="submit">SEND<span aria-hidden="true">→</span></button>
   <div class="contact-result" aria-live="polite"></div>
  </form>
 </div></section>`;
}
function loginPage(params) {
 return `${pageHead('WELCOME TO SEMI LINK',L('다음 연결을 시작하세요','Your next connection starts here'),'',L('로그인','Log in'))}<section class="section container"><div class="auth-wrap"><div class="form-card"><div class="auth-title"><h2>${L('로그인','Log in')}</h2><p>${L('업무 이메일로 로그인하세요','Sign in with your work email')}</p></div>${auth.isLoggedIn()?`<p>${L('로그인되어 있습니다','You are signed in')}</p>${button('#/front/etch',L('부품 탐색 시작','Explore parts'),'primary')}`:loginForm('page')}<div class="auth-links">${L('아직 회원이 아니신가요?','New to SEMI LINK?')}<a href="#/signup${params.get('return')?'?return='+encodeURIComponent(params.get('return')):''}">${L('회원가입','Sign up')}</a></div></div></div></section>`;
}
function signupPage() {
 return `${pageHead('JOIN THE CONNECTION',L('새로운 공급의 기회를 만나세요','Discover new sourcing possibilities'),'',L('회원가입','Sign up'))}<section class="section container"><div class="auth-wrap"><div class="form-card"><div class="auth-title"><h2>${L('회원가입','Create an account')}</h2><p>${L('SEMI LINK와 연결을 시작하세요','Start connecting with SEMI LINK')}</p></div><form data-form="signup">${field('company',L('회사명','Company'),'text',true)}${field('name',L('이름','Name'),'text',true)}${field('email',L('업무 이메일','Work email'),'email',true)}<div class="field"><label for="signup-password">${L('비밀번호','Password')}</label><input id="signup-password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="${L('8자 이상 입력해 주세요','At least 8 characters')}"></div><div class="field"><label for="member-type">${L('회원 유형','Account type')}</label><select id="member-type" name="memberType" required><option value="buyer">${L('구매사','Buyer')}</option><option value="supplier">${L('공급사','Supplier')}</option></select></div><label class="check-row"><input name="terms" type="checkbox" required><span><a href="#/terms" target="_blank" rel="noopener">${L('이용약관','Terms of use')}</a>${L('에 동의합니다',' — I agree')}</span></label><label class="check-row"><input name="privacy" type="checkbox" required><span><a href="#/privacy" target="_blank" rel="noopener">${L('개인정보 수집·이용','Privacy policy')}</a>${L('에 동의합니다',' — I agree')}</span></label><div class="form-error" role="alert" hidden></div><button class="btn primary block" type="submit">${L('회원가입','Create account')}${arrow}</button></form><div class="auth-links">${L('이미 회원이신가요?','Already a member?')}<a href="#/login">${L('로그인','Log in')}</a></div></div></div></section>`;
}
function legalPage(type) {
 const privacy=type==='privacy',c=data.company,mail=`<a class="text-link" href="mailto:${c.email}">${c.email}</a>`;
 const sec=(t,b)=>`<section><h3>${t}</h3>${b}</section>`,ul=a=>`<ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
 const pv=lang==='ko'?[
  sec('1. 처리 목적',ul(['회원 가입·로그인과 회원 확인','부품·소재·공급사 상담 문의 접수와 회신','부정 이용 방지와 서비스 운영 기록'])),
  sec('2. 처리 항목',ul(['회원 가입 — 회사명, 이름, 업무 이메일, 비밀번호(복원할 수 없게 암호화해 저장), 회원 유형','문의 — 구분, 회사명, 사업장 위치, 담당자 이름, 이메일, 문의 내용 · 선택 항목으로 사업자등록번호, 휴대전화','자동 기록 — 가입·문의·최근 로그인 일시'])),
  sec('3. 보유 기간',ul(['회원 정보 — 탈퇴를 요청할 때까지','문의 정보 — 상담을 마친 날부터 1년','법령에 보관 의무가 있으면 그 기간까지'])),
  sec('4. 제3자 제공',ul(['정보주체의 동의나 법령의 근거 없이 제3자에게 제공하지 않습니다'])),
  sec('5. 처리 위탁과 국외 이전',ul(['수탁자 — Google LLC (Google Workspace 시트·메일)','위탁 업무 — 회원·문의 정보 저장과 담당자 알림 메일 발송','이전 국가·방법 — 미국 등 Google 데이터센터 · 가입이나 문의를 보낼 때 네트워크로 전송','보유 기간 — 위 3항과 같음','국외 이전을 원하지 않으면 가입·온라인 문의 대신 이메일·전화로 상담하실 수 있습니다'])),
  sec('6. 파기',ul(['보유 기간이 끝나거나 목적을 이루면 지체 없이 삭제합니다','전자 파일은 복구할 수 없는 방법으로 지웁니다'])),
  sec('7. 정보주체의 권리',ul(['열람, 정정, 삭제, 처리 정지, 회원 탈퇴를 언제든 요청할 수 있습니다',`요청은 ${mail} 로 보내 주시면 10일 안에 처리합니다`])),
  sec('8. 안전성 확보 조치',ul(['비밀번호는 원문을 저장하지 않고 일방향 암호화 값만 보관합니다','관리 시트는 지정된 담당자만 열람할 수 있습니다','전송 구간은 HTTPS로 암호화됩니다'])),
  sec('9. 브라우저 저장 정보',ul(['로그인 유지를 위해 서명된 로그인 표시(14일)와 이름·회사명을 브라우저 저장소에 둡니다','광고·추적용 쿠키는 쓰지 않습니다 · 로그아웃하면 지워집니다'])),
  sec('10. 개인정보 보호책임자',ul([`${esc(c.ceo)} · SEMILAB GLOBAL <span class="nb">Co., Ltd.</span>`,`이메일 ${mail} · 전화 ${esc(c.phone)}`,'개인정보 침해 신고 — 개인정보침해신고센터 118 · privacy.kisa.or.kr'])),
  sec('11. 시행일',ul(['이 방침은 2026년 10월 28일부터 적용합니다']))
 ]:[
  sec('1. Purpose',ul(['Account sign-up, login and verification','Receiving and answering sourcing inquiries','Preventing misuse and keeping service records'])),
  sec('2. Data collected',ul(['Account — company, name, work email, password (stored only as a one-way hash), account type','Inquiry — type, company, business location, contact name, email, message · optional registration number and mobile','Automatic — timestamps of sign-up, inquiry and last login'])),
  sec('3. Retention',ul(['Account data — until you ask us to delete your account','Inquiry data — one year after the consultation ends','Longer only where the law requires'])),
  sec('4. Third parties',ul(['We do not share your data without your consent or a legal basis'])),
  sec('5. Processors and overseas transfer',ul(['Google LLC (Google Workspace sheets and mail) stores account and inquiry data and sends staff notifications','Data may be stored in Google data centers in the United States and elsewhere','If you prefer no overseas transfer, contact us by email or phone instead'])),
  sec('6. Deletion',ul(['Data is deleted without delay when retention ends'])),
  sec('7. Your rights',ul([`Request access, correction, deletion or account closure at ${mail} — handled within 10 days`])),
  sec('8. Security',ul(['Passwords are never stored in plain text','Only designated staff can open the admin sheet','All traffic is encrypted with HTTPS'])),
  sec('9. Browser storage',ul(['A signed login marker (14 days), your name and company are kept in browser storage · No advertising or tracking cookies'])),
  sec('10. Privacy officer',ul([`${esc(c.ceo)} · SEMILAB GLOBAL <span class="nb">Co., Ltd.</span> · ${mail} · ${esc(c.phone)}`])),
  sec('11. Effective date',ul(['October 28, 2026']))
 ];
 const tm=lang==='ko'?[
  sec('1. 목적',ul(['SEMILAB GLOBAL이 운영하는 SEMI LINK(이하 서비스)의 이용 조건을 정합니다'])),
  sec('2. 회원 가입',ul(['업무 이메일로 가입하며 입력한 정보는 사실이어야 합니다','타인의 정보로 가입하거나 계정을 넘겨 쓰면 이용을 제한할 수 있습니다'])),
  sec('3. 서비스 내용',ul(['공정·챔버·부품·소재별 대체 공급원 탐색과 상담 연결','공급사 정보 일부는 예시이며 실제 공급 조건은 상담으로 확인합니다'])),
  sec('4. 회원의 의무',ul(['서비스 정보를 무단으로 복제·배포하거나 자동 수집하지 않습니다','서비스 운영을 방해하는 행위를 하지 않습니다'])),
  sec('5. 이용 제한과 탈퇴',ul(['의무를 어기면 사전 안내 후 이용을 제한할 수 있습니다',`탈퇴는 ${mail} 로 요청하시면 처리합니다`])),
  sec('6. 책임의 범위',ul(['서비스의 품번·호환 정보는 참고 자료이며 실제 적용 전 도면과 사양을 확인해야 합니다','천재지변·통신 장애 등 불가항력으로 생긴 손해는 책임지지 않습니다'])),
  sec('7. 약관 변경',ul(['약관을 바꾸면 적용 7일 전에 서비스에 알립니다'])),
  sec('8. 시행일',ul(['2026년 10월 28일']))
 ]:[
  sec('1. Purpose',ul(['These terms govern SEMI LINK, operated by SEMILAB GLOBAL'])),
  sec('2. Accounts',ul(['Sign up with a work email and accurate details · Accounts may not be shared'])),
  sec('3. Service',ul(['Finding alternative sources by process, chamber, part and material, and connecting to consultation','Some supplier entries are examples · Actual terms are confirmed through consultation'])),
  sec('4. Your obligations',ul(['No unauthorized copying, redistribution or automated scraping','No interference with the service'])),
  sec('5. Restriction and closure',ul([`We may restrict accounts that break these terms · Request closure at ${mail}`])),
  sec('6. Liability',ul(['Part and compatibility data is for reference · Verify drawings and specifications before use','We are not liable for force majeure or network outages'])),
  sec('7. Changes',ul(['Changes are announced on the service 7 days before they apply'])),
  sec('8. Effective date',ul(['October 28, 2026']))
 ];
 return `${pageHead('SEMI LINK',privacy?L('개인정보처리방침','Privacy policy'):L('이용약관','Terms of use'),'',L('이용 안내','Information'))}<section class="section container"><div class="legal-box legal-doc">${(privacy?pv:tm).join('')}</div></section>`;
}
function notFound() {return `${pageHead('SEMI LINK',L('페이지를 찾을 수 없습니다','Page not found'),L('주소를 확인하거나 첫 화면에서 다시 시작해 주세요','Check the address or return to the home page'))}<section class="section container"><div class="button-row">${button('#/',L('첫 화면으로','Return home'),'primary')}</div></section>`;}

function toast(message) {const el=document.querySelector('#toast');clearTimeout(toastTimer);el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),4200);}
function openModal(title,content,onSuccess) {
 closeModal(false);lastModalFocus=document.activeElement;modalOnSuccess=onSuccess;
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="${L('닫기','Close')}">×</button></div>${content}</section></div>`;
 main.inert=true;header.inert=true;footer.inert=true;document.body.style.overflow='hidden';
 modalRoot.querySelector('input, .btn, .icon-button')?.focus({preventScroll:true});
}
function closeModal(restore=true) {
 if(!modalRoot.childElementCount)return;
 modalRoot.innerHTML='';main.inert=false;header.inert=false;footer.inert=false;document.body.style.overflow='';
 if(restore&&lastModalFocus?.isConnected)lastModalFocus.focus({preventScroll:true});
 modalOnSuccess=null;
}
function showPremium() {
 openModal(L('프리미엄 회원 전용','For premium members'),`<div class="premium-mark">${icon('lock')}</div><p>${L('공급사 연락처와 견적 요청은 프리미엄 회원에게 제공됩니다','Supplier contacts and quotation requests are available to premium members')}</p><div class="button-row"><button class="btn primary" data-action="subscribe">${L('프리미엄 구독하기','Subscribe to premium')}</button>${button(`#/contact?part=${encodeURIComponent(selectedPart()?.name||'')}`,L('상담 신청','Contact us'),'outline')}</div>`);
}
function moreDetail() {
 if(auth.isLoggedIn())return showPremium();
 openModal(L('로그인이 필요합니다','Please log in to continue'),`<p style="margin-bottom:22px">${L('로그인 후 공급사 상세 안내를 확인하세요','Log in to continue to supplier details')}</p>${loginForm('modal')}<div class="auth-links">${L('아직 회원이 아니신가요?','New to SEMI LINK?')}<a href="#/signup?return=${encodeURIComponent(location.hash)}">${L('회원가입','Sign up')}</a></div>`,showPremium);
}
function showPaymentNotice() {
 openModal(L('프리미엄 구독 안내','Premium subscription'),`<p>${L('결제 기능은 준비 중입니다 — 상담 신청으로 안내해 드립니다','Payment is coming soon — Please contact us for subscription guidance')}</p><div class="button-row">${button('#/contact',L('상담 신청','Contact us'),'primary')}</div>`);
}
let c3dApi=null;
function bindChamber3D() {
 const box=document.querySelector('[data-c3d]');if(!box)return;
 const id=box.dataset.c3d;let alive=true;
 const card=box.closest('.diagram-card');
 const setMode=mode=>{card.querySelectorAll('[data-c3d-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.c3dMode===mode)));box.hidden=mode!=='3d';card.querySelector('.c2d').hidden=mode!=='2d';card.querySelector('.c3d-tools').hidden=mode!=='3d';card.classList.toggle('mode-2d',mode==='2d');const lb=card.querySelector('.diagram-label');if(lb)lb.textContent=mode==='2d'?L('단면도 · 부품을 누르면 소재가 열립니다','Section · tap a part'):lb.dataset.t3d||lb.textContent;if(mode==='3d')c3dApi?.resize();};
 card.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.c3dMode)setMode(b.dataset.c3dMode);
  if(b.hasAttribute('data-c3d-explode')){const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));c3dApi?.setExploded(on);}
  if(b.hasAttribute('data-c3d-full')){const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));c3dApi?.setView(on?'full':'section');}
  if(b.hasAttribute('data-c3d-reset')){c3dApi?.select(null);c3dApi?.setExploded(false);c3dApi?.setView('section');card.querySelectorAll('[data-c3d-explode],[data-c3d-full]').forEach(x=>x.setAttribute('aria-pressed','false'));}
 });
 Promise.all([getJSON('data/chambers3d.json'),import('./chamber3d.js')]).then(([geo,mod])=>{
  if(!alive)return;
  box.querySelector('.c3d-loading')?.remove();
  c3dApi=mod.mountChamber3D(box,{chamber:data.chambers[id],geo:geo[id],materials:data.materials,lang},{
   onHover(){},
   async onSelect(partId){if(partId){explorer={part:partId,material:null,supplier:null};await renderPanels(false);}}
  });
  if(box.dataset.webgl==='off')setMode('2d');
 }).catch(err=>{console.warn('3D chamber unavailable',err);if(alive)setMode('2d');});
 return ()=>{alive=false;c3dApi?.destroy();c3dApi=null;};
}
// 전 구역 마우스 점 격자: 커서 주변 점이 밝아짐(첫 화면은 자체 격자를 씀)
function cursorGrid() {
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
 const cv=document.createElement('canvas');cv.className='x-cursor-grid';cv.setAttribute('aria-hidden','true');document.body.append(cv);
 const ctx=cv.getContext('2d');let w,h,dpr,tx=-999,ty=-999,mx=-999,my=-999,on=0,target=0,raf=0;
 const size=()=>{dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;cv.width=w*dpr;cv.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);};
 const darkAt=(x,y)=>{let el=document.elementFromPoint(x,y);while(el&&el!==document.body){const c=getComputedStyle(el);if(el.matches('.x-dark,.page-head,.x-chamber-teaser,.diagram-card:not(.mode-2d),.x-portfolio,.cta,footer,.site-footer'))return true;if(c.backgroundColor&&c.backgroundColor!=='rgba(0, 0, 0, 0)'&&!c.backgroundImage.includes('gradient'))return false;el=el.parentElement;}return false;};
 let dark=false;
 const draw=()=>{raf=0;mx+=(tx-mx)*.22;my+=(ty-my)*.22;on+=(target-on)*.12;ctx.clearRect(0,0,w,h);
  if(on>.01){const s=36,R=220,ox=-(scrollX%s),oy=-(scrollY%s);const col=dark?'94,231,255':'49,130,246';
   const g=ctx.createRadialGradient(mx,my,0,mx,my,R);g.addColorStop(0,`rgba(${col},${(dark?.14:.08)*on})`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;ctx.fillRect(mx-R,my-R,R*2,R*2);
   for(let x=ox+s/2;x<w;x+=s){if(Math.abs(x-mx)>R)continue;for(let y=oy+s/2;y<h;y+=s){const d=Math.hypot(x-mx,y-my);if(d>R)continue;const a=(1-d/R)**1.3*on;ctx.fillStyle=`rgba(${col},${Math.min(1,a*(dark?1:.85))})`;const r=1.2+a*3.2;ctx.fillRect(x-r/2,y-r/2,r,r);}}}
  if(Math.abs(tx-mx)>.5||Math.abs(ty-my)>.5||Math.abs(target-on)>.01)raf=requestAnimationFrame(draw);};
 const kick=()=>{if(!raf)raf=requestAnimationFrame(draw);};
 let last=0;
 addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY;if(mx<-900){mx=tx;my=ty;}const quiet=e.target.closest?.('.x-hero,.c3d,.diagram-card,.explorer-stage,.x-trail,form,.x-login,.x-gsearch,table,.table-scroll,.catalog-controls,.pagination,.modal,[role=dialog],input,textarea,select,button,a,.x-tile,.x-contact,.product-card,.part-picker');target=quiet?0:1;const now=performance.now();if(now-last>120){last=now;dark=darkAt(tx,ty);}kick();},{passive:true});
 addEventListener('scroll',()=>{dark=darkAt(tx,ty);kick();},{passive:true});
 document.addEventListener('pointerleave',()=>{target=0;kick();});
 addEventListener('resize',()=>{size();kick();});size();
}
// 외톨이 글자 방지: 마지막 낱말을 앞 낱말에 붙이고, 가운뎃점은 앞 낱말에 붙인다
function noOrphans(root=document.querySelector('main')) {
 if(!root)return;
 root.querySelectorAll('h1,h2,h3,p,li,dd,dt,figcaption,small,b,label,legend,.x-big,.diagram-label,.x-hero-lead,em,span:not([data-counter])').forEach(el=>{
  if(el.closest('svg,script,table'))return;
  const texts=[];const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=tw.nextNode())if(n.data.trim())texts.push(n);
  texts.forEach(t=>{if(t.data.includes(' · '))t.data=t.data.replaceAll(' · ',' · ');});
  const last=texts[texts.length-1];if(!last||last.parentElement!==el&&last.parentElement.closest('h1,h2,h3,p,li,dd,dt,figcaption,small,b,label,legend')!==el)return;
  const m=last.data.match(/^(.*\S) (\S{1,8})(\s*)$/s);if(m)last.data=`${m[1]} ${m[2]}${m[3]}`;
 });
}
function bindHome() {
 const cleanups=[];
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 // 스크롤 등장
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
 document.querySelectorAll('.rv').forEach(el=>io.observe(el));cleanups.push(()=>io.disconnect());
 // 첫 화면 빛나는 격자: 마우스 근처 점이 밝아짐
 const cv=document.querySelector('.x-hero-grid');
 if(cv&&!reduce){
  const ctx=cv.getContext('2d');let w,h,mx=-999,my=-999,raf,visible=true,t0=performance.now();
  const size=()=>{const r=cv.getBoundingClientRect();w=cv.width=Math.round(r.width);h=cv.height=Math.round(r.height);};
  const draw=now=>{raf=requestAnimationFrame(draw);if(!visible)return;ctx.clearRect(0,0,w,h);const s=48,tt=(now-t0)/1000;
   for(let x=s/2;x<w;x+=s)for(let y=s/2;y<h;y+=s){const d=Math.hypot(x-mx,y-my);const wave=.5+.5*Math.sin(tt*1.2+(x+y)/140);const a=Math.max(0,1-d/340)**1.4;const al=Math.min(1,.08+.1*wave+a*1.1);ctx.fillStyle=a>0.02?`rgba(94,231,255,${al})`:`rgba(160,190,240,${al})`;const r=1.3+a*4;ctx.fillRect(x-r/2,y-r/2,r,r);}
   if(mx>-900){const g=ctx.createRadialGradient(mx,my,0,mx,my,260);g.addColorStop(0,'rgba(64,170,255,.16)');g.addColorStop(1,'rgba(64,170,255,0)');ctx.fillStyle=g;ctx.fillRect(mx-260,my-260,520,520);}
  };
  size();raf=requestAnimationFrame(draw);
  const hero=document.querySelector('.x-hero');
  const move=e=>{const r=cv.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top;};
  hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',()=>{mx=my=-999;});
  const vio=new IntersectionObserver(([e])=>{visible=e.isIntersecting;});vio.observe(hero);
  window.addEventListener('resize',size);
  cleanups.push(()=>{cancelAnimationFrame(raf);vio.disconnect();window.removeEventListener('resize',size);});
 }
 // 첫 화면 영상 살짝 따라 움직임(시차)
 const media=document.querySelector('.x-hero-media');
 if(media&&!reduce){const onScroll=()=>{const y=Math.min(window.scrollY,900);media.style.transform=`scale(1.04) translateY(${y*0.25}px)`;};window.addEventListener('scroll',onScroll,{passive:true});cleanups.push(()=>window.removeEventListener('scroll',onScroll));}
 return ()=>cleanups.forEach(fn=>fn());
}
function headerScroll() {
 const set=()=>header.classList.toggle('scrolled',window.scrollY>40);set();window.addEventListener('scroll',set,{passive:true});
}
function animateCounters() {
 if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;observer.unobserve(entry.target);
  const el=entry.target;const final=el.dataset.value;const isRange=final.includes('–');const targets=final.split('–').map(Number);const start=performance.now();
  const tick=now=>{if(!el.isConnected)return;const p=Math.min(1,(now-start)/650);el.textContent=targets.map(v=>Math.round(v*(1-(1-p)**3)).toLocaleString('en-US')).join(isRange?'\u2009–\u2009':'');if(p<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);
 }),{threshold:.5});
 document.querySelectorAll('[data-counter]').forEach(el=>observer.observe(el));
 return ()=>observer.disconnect();
}
function bindPage() {
 const cleanups=[];
 // Optional client-supplied hero images leave the gradient illustration intact on failure.
 document.querySelectorAll('[data-optional-image]').forEach(img=>{const hide=()=>{img.hidden=true;};img.addEventListener('error',hide,{once:true});if(img.complete&&!img.naturalWidth)hide();});
 document.querySelectorAll('[data-counter]').forEach(el=>{if(el.textContent.includes('–'))el.textContent=el.textContent.replace(/\s*–\s*/,'\u2009–\u2009');});
 noOrphans();
 const stopCounter=animateCounters();if(stopCounter)cleanups.push(stopCounter);
 if(document.querySelector('.x-hero')) cleanups.push(bindHome());
 else if(document.querySelector('.rv')){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});document.querySelectorAll('.rv').forEach(el=>io.observe(el));cleanups.push(()=>io.disconnect());}
 bindProducts().catch(err=>console.warn('products',err));
 const c3dStop=bindChamber3D();if(c3dStop)cleanups.push(c3dStop);
 if(document.querySelector('#catalog-results')) {
  renderCatalog();let timer;
  const search=document.querySelector('#product-search');
  search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{catalogState.query=search.value;catalogState.page=1;renderCatalog();},140);});
  ['oem','size'].forEach(key=>document.querySelector(`#${key}-filter`).addEventListener('change',event=>{catalogState[key]=event.target.value;catalogState.page=1;renderCatalog();}));
  cleanups.push(()=>clearTimeout(timer));
 }
 const preview=document.querySelector('.diagram-preview');
 if(preview) {
  const show=event=>{const part=event.target.closest('[data-part]');if(!part)return;preview.textContent=activeChamber.parts.find(p=>p.id===part.dataset.part)?.name||'';preview.classList.add('visible');};
  const hide=()=>preview.classList.remove('visible');
  document.querySelector('.chamber-svg').addEventListener('pointerover',show);
  document.querySelector('.chamber-svg').addEventListener('focusin',show);
  document.querySelector('.chamber-svg').addEventListener('pointerleave',hide);
  document.querySelector('.chamber-svg').addEventListener('focusout',hide);
 }
 return ()=>cleanups.forEach(fn=>fn());
}
function safeReturn(params) { const path=params.get('return');return path?.startsWith('#/')&&!path.includes('://')?path:'#/front/etch'; }
async function render({preserveScroll=false}={}) {
 const version=++routeVersion;
 const scroll=window.scrollY;
 pageCleanup();closeModal(false);activeChamber=null;explorer={part:null,material:null,supplier:null};
 const {path,params}=routeInfo(location.hash);
 document.body.dataset.route=path;
 nav();renderFooter();document.documentElement.lang=lang;
 let result;
 try {
  if(path==='/')result=home();
  else if(path==='/company')result=companyPage();
  else if(path==='/front/etch'||path==='/front/deposition')result=chamberPage(path.split('/').pop());
  else if(path==='/back')result=backPage();
  else if(path==='/products')result=productsPage();
  else if(path.startsWith('/products/'))result=await categoryPage(path.split('/')[2]);
  else if(path==='/contact')result=contactPage(params);
  else if(path==='/login')result=loginPage(params);
  else if(path==='/signup')result=signupPage();
  else if(path==='/privacy'||path==='/terms')result=legalPage(path.slice(1));
  else result=notFound();
  if(version!==routeVersion)return;
  const title=typeof result==='object'?result.cat.name:titles()[path]||L('페이지를 찾을 수 없습니다','Page not found');
  document.title=`${title} | SEMI LINK`;
  if(typeof result==='object'){catalogRows=result.rows;currentCategory=result.cat;catalogState={query:'',oem:'',size:'',page:1};}
  main.innerHTML=`<div class="route-enter">${typeof result==='object'?result.html:result}</div>`;
  pageCleanup=bindPage();
  if(!preserveScroll){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}else window.scrollTo({top:scroll,behavior:'instant'});
 } catch(error) {
  if(version!==routeVersion)return;
  console.error('Page loading failed:',error);
  main.innerHTML=`<div class="fatal"><h1>${L('페이지를 불러오지 못했습니다','Unable to load this page')}</h1><p>${L('잠시 후 다시 시도해 주세요','Please try again in a moment')}</p><button class="btn primary" data-action="retry">${L('다시 시도','Try again')}</button></div>`;
 }
}

// Central navigation and interaction handlers also cover content inserted after routing.
document.addEventListener('click',async event=>{
 const target=event.target.closest('a,button,[data-part]');if(!target)return;
 if(target.classList.contains('skip-link')){event.preventDefault();main.focus({preventScroll:true});main.scrollIntoView({behavior:'instant'});return;}
 if(target.matches('a[href^="#/"]')){closeModal(false);header.querySelector('.primary-nav')?.classList.remove('expanded');header.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');const toggle=header.querySelector('.menu-toggle');if(toggle)toggle.textContent='☰';if(target.hash===location.hash){event.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}return;}
 if(target.dataset.page){catalogState.page=Number(target.dataset.page);renderCatalog();document.querySelector('.table-scroll')?.focus({preventScroll:true});return;}
 const partId=target.dataset.part||target.dataset.selectPart;
 if(partId){explorer={part:partId,material:null,supplier:null};c3dApi?.select(partId);await renderPanels();return;}
 if(target.dataset.material){explorer.material=target.dataset.material;explorer.supplier=null;await renderPanels();return;}
 if(target.dataset.supplier){explorer.supplier=target.dataset.supplier;await renderPanels();return;}
 if(target.dataset.back){if(target.dataset.back==='1')explorer.material=null;explorer.supplier=null;await renderPanels();return;}
 const action=target.dataset.action;
 if(action==='menu'){const expanded=target.getAttribute('aria-expanded')!=='true';target.setAttribute('aria-expanded',expanded);header.querySelector('.primary-nav').classList.toggle('expanded',expanded);target.textContent=expanded?'×':'☰';}
 if(action==='front-menu'){const expanded=target.getAttribute('aria-expanded')!=='true';target.setAttribute('aria-expanded',expanded);target.parentElement.classList.toggle('open',expanded);}
 if(action==='language'){lang=lang==='ko'?'en':'ko';safeStorage(storage,'semilink.language',lang);await render({preserveScroll:true});}
 if(action==='logout'){auth.logout();await render({preserveScroll:true});toast(L('로그아웃되었습니다','You are now signed out'));}
 if(action==='close-modal')closeModal();
 if(action==='close-explorer')closeExplorer();
 if(action==='more-detail')moreDetail();
 if(action==='subscribe')showPaymentNotice();
 if(action==='retry')await render();
});
modalRoot.addEventListener('click',event=>{if(event.target.classList.contains('modal-backdrop'))closeModal();});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){
  if(modalRoot.childElementCount)closeModal();
  else if(explorer.part)closeExplorer();
  else{header.querySelector('.primary-nav')?.classList.remove('expanded');header.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');header.querySelector('.nav-group')?.classList.remove('open');header.querySelector('[data-action="front-menu"]')?.setAttribute('aria-expanded','false');const btn=header.querySelector('.menu-toggle');if(btn)btn.textContent='☰';}
 }
 if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-part]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
 const trap=modalRoot.querySelector('.modal')||(explorer.part&&window.matchMedia('(max-width: 1000px)').matches?document.querySelector('.explorer-panel:last-child'):null);
 if(event.key==='Tab'&&trap){const focusables=[...trap.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled);const first=focusables[0],last=focusables.at(-1);if(event.shiftKey&&(document.activeElement===first||!trap.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!trap.contains(document.activeElement))){event.preventDefault();first?.focus();}}
});
function authMessage(reason){return ({nomember:L('가입된 이메일이 아닙니다 · 회원가입 후 로그인해 주세요','No account with this email — Please sign up first'),wrong:L('비밀번호가 맞지 않습니다','Incorrect password'),blocked:L('이용이 제한된 계정입니다 · 문의하기로 연락해 주세요','This account is restricted — Please contact us'),exists:L('이미 가입된 이메일입니다 · 로그인해 주세요','This email is already registered — Please log in'),busy:L('시도가 많습니다 · 10분 뒤 다시 해 주세요','Too many attempts — Try again in 10 minutes'),network:L('연결이 원활하지 않습니다 · 잠시 후 다시 해 주세요','Connection problem — Please try again'),server:L('잠시 후 다시 해 주세요','Please try again shortly')})[reason]||L('입력 내용과 동의 항목을 확인해 주세요','Please check your details and required agreements');}
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('[data-form]'))return;event.preventDefault();form.querySelectorAll('.x-field').forEach(x=>x.classList.toggle('bad',[...x.querySelectorAll('input,textarea')].some(i=>!i.checkValidity())));if(!form.reportValidity())return;
 const values=Object.fromEntries(new FormData(form));
 const err=form.querySelector('.form-error');if(err)err.hidden=true;
 if(form.dataset.form==='login') {
  const btn=form.querySelector('[type="submit"]');btn.disabled=true;
  const result=await auth.login(values);btn.disabled=false;
  form.querySelector('[name="password"]').value='';
  if(!result.ok){err.textContent=authMessage(result.reason);err.hidden=false;return;}
  const callback=modalOnSuccess;
  if(callback){closeModal(false);nav();callback();}else{const {params}=routeInfo(location.hash);if(routeInfo(location.hash).path==='/login')location.hash=safeReturn(params);else await render({preserveScroll:true});toast(L('로그인되었습니다','You are now signed in'));}
 }
 if(form.dataset.form==='signup') {
  const btn=form.querySelector('[type="submit"]');btn.disabled=true;
  const result=await auth.signup(values);btn.disabled=false;
  if(!result.ok){err.textContent=authMessage(result.reason);err.hidden=false;return;}
  form.querySelector('[name="password"]').value='';
  const {params}=routeInfo(location.hash);location.hash=safeReturn(params);toast(L('회원가입이 완료되었습니다','Your account is ready'));
 }
 if(form.dataset.form==='contact') {
  const btn=form.querySelector('[type="submit"]'),result=form.querySelector('.contact-result');btn.disabled=true;btn.classList.add('sending');
  try{const out=await submitContact(values,data.company.inquiryEmail||data.company.email);
   if(out.url){window.location.href=out.url;result.innerHTML=`<div class="form-success">${L('메일 앱에서 전송하면 문의가 접수됩니다','Send it from your email app to complete')}</div>`;}
   else{form.reset();form.querySelectorAll('.x-field,.x-type').forEach(x=>x.classList.remove('bad'));result.innerHTML=`<div class="form-success x-sent"><b>${L('문의가 접수되었습니다','Your inquiry has been sent')}</b>${L('확인 후 빠르게 연락드리겠습니다','We will contact you shortly')}</div>`;result.scrollIntoView({block:'center',behavior:'smooth'});}}
  catch(error){err.innerHTML=`${L('전송하지 못했습니다 — 잠시 후 다시 시도하시거나 메일 앱으로 보내 주세요','Could not send — Try again or use your email app')} ${error.mailto?`<a href="${esc(error.mailto)}">${L('메일 앱으로 보내기','Send via email app')}</a>`:''}`;err.hidden=false;}
  finally{btn.disabled=false;btn.classList.remove('sending');}
 }

});
window.addEventListener('hashchange',()=>{if(data)render();});
window.addEventListener('storage',event=>{if(event.key==='semilink.session'&&data)nav();});
try {
 const keys=['company','categories','processes','chambers','materials','suppliers','material-groups','technical-specs'];
 const values=await Promise.all(keys.map(key=>getJSON(`data/${key}.json`)));
 data=Object.fromEntries(keys.map((key,i)=>[key==='material-groups'?'materialGroups':key==='technical-specs'?'technicalSpecs':key,values[i]]));
 headerScroll();cursorGrid();
 await render();
} catch(error) {
 console.error('Site initialization failed:',error);
 main.innerHTML=`<div class="fatal"><h1>${L('페이지를 불러오지 못했습니다','Unable to load this page')}</h1><p>${L('인터넷 연결을 확인한 뒤 새로고침해 주세요','Check your connection and reload the page')}</p></div>`;
}
