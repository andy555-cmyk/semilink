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
  footer.innerHTML=`<div class="container"><div class="footer-top"><div><a class="logo" href="#/" aria-label="SEMI LINK ${L('첫 화면','home')}">${logo()}</a><div class="footer-info"><div>Operated by ${esc(c.name)}</div><div>${L('대표','CEO')} ${esc(c.ceo)}</div><div class="footer-contact"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><a href="tel:${c.phone.replaceAll('-','')}">${esc(c.phone)}</a><a href="${esc(c.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div></div></div><div class="footer-links"><a href="#/privacy">${L('개인정보처리방침','Privacy policy')}</a><a href="#/terms">${L('이용약관','Terms of use')}</a></div></div><div class="footer-bottom"><span>© 2026 SEMI LINK. All rights reserved.</span><span>${L('장비사명은 호환 장비를 안내하기 위해 표기했습니다.','Equipment names identify compatible tools.')}</span></div></div>`;
}
function pageHead(eyebrow,title,description,breadcrumb='') {
  return `<div class="page-head">${eyebrow==='ABOUT SEMI LINK'||eyebrow==='PRODUCT PORTFOLIO'?`<img class="head-photo" data-optional-image src="assets/img/hero/${eyebrow==='ABOUT SEMI LINK'?'hero-wafer':'hero-parts'}.webp" alt="" width="1920" height="800" loading="lazy">`:''}${breadcrumb?`<div class="breadcrumbs"><a href="#/">SEMI LINK</a><span>/</span><span>${breadcrumb}</span></div>`:''}<span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>`;
}
function processStrip(selected) {
 return `<div class="process-strip" aria-label="${L('반도체 8대 공정','Eight semiconductor processes')}">${data.processes.map(p=>{
 const content=`<span class="number">0${p.number}</span>${icon(p.id)}<span>${esc(loc(p.name))}</span>${!p.route?`<small>${L('준비 중','Coming soon')}</small><span class="hint">${L('공정 정보를 준비하고 있습니다.','Process information is coming soon.')}</span>`:''}`;
 return p.route?`<a class="process-item available ${selected===p.id?'selected':''}" href="${p.route}" ${selected===p.id?'aria-current="page"':''}>${content}</a>`:`<button type="button" class="process-item unavailable" aria-disabled="true" title="${L('공정 정보를 준비하고 있습니다.','Process information is coming soon.')}">${content}</button>`;
 }).join('')}</div>`;
}
function strengths() {
 return `<div class="stats">${data.company.strengths.map((s,i)=>`<div class="stat"><div class="stat-label">${esc(loc(s.label))}</div><div class="stat-value"><span data-counter="${i}" data-value="${s.value}">${s.value}</span><small>${esc(loc(s.unit))}</small></div><p>${esc(loc(s.description))}</p></div>`).join('')}</div><div class="support-note"><span>${L('샘플·소량 시험 주문 환영','Evaluation samples and trial orders welcome')}</span><span>${L('전 과정 이력 추적','Full process traceability')}</span></div>`;
}
function cta() {
 return `<div class="cta"><div><h2>${L('찾는 부품이 있으신가요?','Looking for a specific part?')}</h2><p>${L('품번이나 도면을 보내 주세요. 적합한 공급원을 함께 찾습니다.','Share your part number or drawing. Let’s find the right source.')}</p></div>${button('#/contact',L('부품 상담 신청','Discuss your parts'),'outline')}</div>`;
}
function loginForm(context='page') {
 return `<form data-form="login" data-context="${context}"><div class="field"><label for="${context}-email">${L('업무 이메일(아이디)','Work email (ID)')}</label><input id="${context}-email" type="email" name="email" autocomplete="username" required placeholder="name@company.com" maxlength="254"></div><div class="field"><label for="${context}-password">${L('비밀번호','Password')}</label><input id="${context}-password" type="password" name="password" autocomplete="current-password" required maxlength="128" placeholder="${L('비밀번호를 입력해 주세요.','Enter your password')}"></div><div class="form-error" role="alert" hidden></div><button class="btn primary block" type="submit">${L('로그인','Log in')}</button></form>`;
}
function home() {
 return `<section class="hero container"><div class="hero-panel"><img class="hero-photo" src="assets/img/hero/hero-fab.webp" data-optional-image alt="" width="1920" height="1080" fetchpriority="high" loading="eager"><div class="hero-copy"><span class="eyebrow">CONNECTING PARTS. EXPANDING POSSIBILITIES.</span><h1>${L('반도체 공정 부품,<br>대체 공급원을 한 번에 찾다','Find qualified 2nd-source parts<br>for every chamber')}</h1><p>${L('공정부터 부품, 소재, 공급사까지.<br>SEMI LINK가 더 나은 공급의 길을 연결합니다.','From process and chamber to material and supplier.<br>SEMI LINK connects you to a better source.')}</p><div class="button-row">${button('#/front/etch',L('공정에서 부품 찾기','Find parts by process'),'teal')}${button('#/signup',L('회원가입','Join SEMI LINK'),'outline')}</div></div><div class="hero-bottom"><div class="hero-facts">${[['30–40%',L('OEM 대비 원가 절감','lower cost than OEM')],['6'+L('주',' wks'),L('한국 출고 납기','lead time from Korea')],['5'+L('일',' days'),L('예비 분석 보고','preliminary analysis')]].map(([a,b])=>`<div><strong>${a}</strong><span>${b}</span></div>`).join('')}</div><div class="login-card">${auth.isLoggedIn()?`<h3>${L('SEMI LINK에 오신 것을 환영합니다.','Welcome to SEMI LINK.')}</h3><p>${L('공정별 부품과 공급사를 찾아보세요.','Explore chamber parts and suppliers.')}</p>${button('#/front/etch',L('부품 찾기','Explore parts'),'primary')}`:`<h3>${L('더 가까워지는 공급망','Your sourcing connection')}</h3><p>${L('회원으로 로그인해 시작하세요.','Sign in to get started.')}</p>${loginForm('hero')}<div class="login-foot"><span>${L('아직 회원이 아니신가요?','New to SEMI LINK?')}</span><a class="text-link" href="#/signup">${L('회원가입','Sign up')}</a></div>`}</div></div></div></section><section class="container process-section"><div class="strip-title"><strong>${L('8대 공정에서 시작하는 부품 탐색','Explore parts across eight processes')}</strong><span>${L('식각·증착 공정 이용 가능','Etch & deposition available')}</span></div>${processStrip()}</section><section class="section soft"><div class="container"><div class="section-head"><span class="eyebrow">A CLEARER PATH TO YOUR PARTS</span><h2>${L('필요한 부품까지, 세 번의 선택','Three steps to the right part')}</h2><p>${L('복잡한 공급망을 쉽고 명확하게 탐색하세요.','A straightforward path through a complex supply chain.')}</p></div><div class="steps">${[['01',icon('etch'),L('공정을 선택하세요.','Choose your process.'),L('챔버 구조도에서 필요한 부품의 위치를 찾습니다.','Find your component in an interactive chamber diagram.')],['02',icon('grid'),L('부품과 소재를 고르세요.','Select a part and material.'),L('부품에 맞는 소재만 골라 살펴볼 수 있습니다.','Explore the materials available for your specific component.')],['03',icon('link'),L('공급사를 확인하세요.','Find your supplier.'),L('공급사의 취급 부품을 확인하고 상담을 신청합니다.','Review available parts and connect through a consultation.')]].map(([n,i,t,p])=>`<article class="step"><span class="step-num">STEP ${n}</span><div class="step-icon">${i}</div><h3>${t}</h3><p>${p}</p></article>`).join('')}</div></div></section><section class="section"><div class="container"><div class="section-head"><span class="eyebrow">WHY SEMI LINK</span><h2>${L('품질은 지키고, 공급의 가능성은 넓히고','Quality you expect. More ways to source.')}</h2><p>${L('SEMILAB GLOBAL의 부품 공급 경험을 연결합니다.','Built on SEMILAB GLOBAL’s component supply experience.')}</p></div>${strengths()}</div></section><section class="section soft"><div class="container"><div class="section-head"><span class="eyebrow">MATERIAL PORTFOLIO</span><h2>${L('공정에 맞는 소재, 필요한 부품','The right material for your process')}</h2><p>${L('다양한 소재와 정밀 부품을 한곳에서 살펴보세요.','Explore a broad range of materials and precision components.')}</p></div><div class="material-grid">${data.materialGroups.map(m=>`<a class="material-card" href="#/products/${m.category}"><div class="material-symbol">${esc(m.formula)}</div><h3>${esc(m.name)}</h3>${arrow}</a>`).join('')}</div><div class="compatibility"><span>${L('호환 장비사','Compatible equipment manufacturers')}</span><div class="oem-list">${data.company.oems.map(esc).join('<span aria-hidden="true">·</span>')}</div></div></div></section><section class="section container">${cta()}</section>`;
}
function companyPage() {
 const c=data.company;
 return `${pageHead('ABOUT SEMI LINK',L('공정과 공급을 잇는 연결','Connecting processes and supply'),L('반도체 부품의 대체 공급원, SEMI LINK에서 찾으세요.','Find your next source for semiconductor components.'),L('회사소개','Company'))}<section class="section container"><div class="company-intro"><div><span class="eyebrow">SEMILAB GLOBAL</span><h2>${L('더 나은 공급의 길을<br>함께 만듭니다.','Creating better<br>paths to supply.')}</h2><p>${esc(loc(c.business))}</p><p>${L('SEMI LINK는 챔버 구조도에서 필요한 부품을 찾고, 소재별 공급사를 살펴볼 수 있는 플랫폼입니다. 장비와 공정에 맞는 부품 탐색부터 상담까지 하나의 흐름으로 연결합니다.','SEMI LINK helps you locate components in chamber diagrams and explore suppliers by material. Move from the part you need to a sourcing conversation in one clear flow.')}</p>${button('#/front/etch',L('공정별 부품 살펴보기','Explore chamber parts'),'outline')}</div><dl class="company-table"><dt>${L('회사명','Company')}</dt><dd>${esc(c.name)}</dd><dt>${L('대표','CEO')}</dt><dd>${esc(c.ceo)}</dd><dt>${L('사업','Business')}</dt><dd>${L('반도체 소모성 부품 대체 공급','Alternative semiconductor consumable parts')}</dd><dt>${L('취급 품목','Portfolio')}</dt><dd>Silicon · SiC · Quartz · Ceramic · Gasket · Machining · Heater · ESC · Metal Liner</dd><dt>${L('이메일','Email')}</dt><dd><a href="mailto:${c.email}">${esc(c.email)}</a></dd><dt>${L('전화','Phone')}</dt><dd><a href="tel:${c.phone.replaceAll('-','')}">${c.phone}</a></dd><dt>LinkedIn</dt><dd><a href="${c.linkedin}" target="_blank" rel="noopener noreferrer">Theo Jeon ↗</a></dd></dl></div></section><section class="section soft"><div class="container"><div class="section-head"><span class="eyebrow">OUR COMMITMENT</span><h2>${L('함께할 수 있는 이유','Why partner with us')}</h2></div>${strengths()}</div></section><section class="section container"><div class="section-head"><span class="eyebrow">WHAT’S NEXT</span><h2>${L('연결의 다음 단계','More connections ahead')}</h2></div><div class="future-grid"><article class="future-card"><span class="badge">${L('준비 중','Coming soon')}</span><h3>${L('회사 연혁','Company milestones')}</h3><p>${L('SEMILAB GLOBAL의 발자취를 소개할 예정입니다.','Discover SEMILAB GLOBAL’s milestones here soon.')}</p></article><article class="future-card"><span class="badge">${L('준비 중','Coming soon')}</span><h3>${L('품질 관리와 공급 역량','Quality and supply capabilities')}</h3><p>${L('품질 관리와 부품 공급에 관한 정보를 소개할 예정입니다.','More information about our quality and supply capabilities is on its way.')}</p></article></div></section><section class="section container">${cta()}</section>`;
}
function productsPage() {
 return `${pageHead('PRODUCT PORTFOLIO',L('공정에 필요한 부품, 한곳에','Components for your process'),L('소재와 품목별로 살펴보고, 품번으로 빠르게 찾아보세요.','Browse by material and category, or find a specific part number.'),L('제품','Products'))}<section class="section container"><div class="product-grid">${data.categories.map(c=>`<a class="product-card" href="#/products/${c.id}"><div class="product-image">${photo(c.images[0],c.name)}</div><div class="product-card-body"><h3>${esc(c.name)}</h3><p>${esc(c.material)}</p><div class="card-bottom"><span>${L('품목 살펴보기','Explore parts')}</span>${arrow}</div></div></a>`).join('')}</div></section><section class="section container">${cta()}</section>`;
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
 return {html:`${pageHead('PRODUCT PORTFOLIO',esc(cat.name),esc(loc(cat.description)),L('제품','Products'))}<section class="section container"><nav class="category-tabs" aria-label="${L('제품 분류','Product categories')}">${data.categories.map(c=>`<a href="#/products/${c.id}" ${id===c.id?'class="current" aria-current="page"':''}>${esc(c.name)}</a>`).join('')}</nav><div class="product-detail-top"><div class="product-gallery">${cat.images.map(i=>`<figure>${photo(i,cat.name)}</figure>`).join('')}</div><div><span class="eyebrow">${esc(cat.material)}</span><h2>${esc(loc(cat.description))}</h2><ul class="feature-list">${loc(cat.features).map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${button(`#/contact?part=${encodeURIComponent(cat.name)}`,L('이 품목 문의하기','Ask about these parts'),'outline')}</div></div>${technicalSpecs(id)}</section><section class="section soft"><div class="container"><div class="catalog-heading"><h2>${L('공급 품번 목록','Available part numbers')}</h2><span>${L('품번·장비명으로 검색하세요.','Search by part number or tool.')}</span></div><div class="catalog-controls"><label class="search-field">${icon('search')}<span class="sr-only">${L('품번·장비명 검색','Search part numbers or tools')}</span><input id="product-search" type="search" placeholder="${L('품번 또는 장비명을 입력해 주세요.','Enter a part number or tool name')}" maxlength="100"></label><select id="oem-filter" aria-label="${L('장비 제조사 필터','Filter by OEM')}"><option value="">${L('모든 장비사','All OEMs')}</option>${[...new Set(rows.map(r=>r.oem))].sort().map(o=>`<option>${esc(o)}</option>`).join('')}</select><select id="size-filter" aria-label="${L('크기 필터','Filter by size')}"><option value="">${L('모든 크기','All sizes')}</option>${[...new Set(rows.flatMap(r=>r.variants.map(v=>v.size)).filter(s=>/^\d+ INCH$/.test(s)))].sort((a,b)=>parseInt(a)-parseInt(b)).map(s=>`<option value="${s}">${s.replace(' INCH',L('인치',' inch'))}</option>`).join('')}</select></div><div id="catalog-results" aria-live="polite"></div><p class="catalog-note">${L('같은 품번의 설명·장비·규격이 여러 개이면 함께 표시합니다. 원자료에 없는 정보는 ‘—’로 표시합니다. 호환 여부와 공급 조건은 상담 시 안내합니다.','Multiple descriptions, tools and sizes for the same part number are shown together. A dash indicates information absent from the source. Compatibility and supply terms are discussed during consultation.')}</p></div></section>`, rows, cat};
}
function renderCatalog() {
 const filtered=filterProducts(catalogRows,catalogState);
 const page=paginate(filtered,catalogState.page);catalogState.page=page.page;
 const node=document.querySelector('#catalog-results');if(!node)return;
 node.innerHTML=`<div class="catalog-heading"><span>${L('총','Total')} <strong>${page.total.toLocaleString()}</strong>${L('개 품번',' part numbers')}</span><span>${page.page} / ${page.pages}</span></div><div class="table-scroll" role="region" tabindex="0" aria-label="${L('품번 목록. 가로로 스크롤할 수 있습니다.','Part number table. Scroll horizontally to view all columns.')}"><table><caption>${esc(currentCategory.name)} ${L('공급 품번','available part numbers')}</caption><thead><tr><th scope="col">OEM</th><th scope="col">Part No.</th><th scope="col">Description</th><th scope="col">Tool</th><th scope="col">${L('규격','Size')}</th><th scope="col"><span class="sr-only">${L('견적 문의','Request quote')}</span></th></tr></thead><tbody>${page.rows.map(r=>`<tr><td>${esc(r.oem)||'—'}</td><td class="part-no">${esc(r.partNo)}</td><td><span class="variant">${esc(r.description)||'—'}</span></td><td>${esc(r.tool)||'—'}</td><td>${esc(r.size)||'—'}</td><td><a class="btn small outline" href="#/contact?part=${encodeURIComponent(r.partNo)}" aria-label="${esc(r.partNo)} ${L('견적 문의','request quote')}">${L('견적 문의','Get quote')}</a></td></tr>`).join('')||`<tr><td colspan="6" class="empty-state">${L('검색 결과가 없습니다. 다른 품번이나 장비명으로 검색해 주세요.','No matches. Try another part number or tool name.')}</td></tr>`}</tbody></table></div><nav class="pagination" aria-label="${L('품번 목록 페이지','Part list pages')}"><button data-page="${page.page-1}" ${page.page===1?'disabled':''} aria-label="${L('이전 페이지','Previous page')}">←</button>${Array.from({length:page.pages},(_,i)=>i+1).filter(n=>n===1||n===page.pages||Math.abs(n-page.page)<=2).map((n,i,list)=>`${i&&n-list[i-1]>1?'<span>…</span>':''}<button data-page="${n}" ${n===page.page?'aria-current="page"':''} aria-label="${n}${L('쪽',' page')}">${n}</button>`).join('')}<button data-page="${page.page+1}" ${page.page===page.pages?'disabled':''} aria-label="${L('다음 페이지','Next page')}">→</button></nav>`;
}
function chamberPage(id) {
 const ch=data.chambers[id];activeChamber=ch;explorer={part:null,material:null,supplier:null};
 return `${pageHead(id==='etch'?'ETCH PROCESS':'DEPOSITION PROCESS',L('챔버에서 시작하는 부품 탐색','Explore parts inside the chamber'),L('부품을 선택하고, 소재와 공급사를 차례로 살펴보세요.','Choose a component, then explore its materials and suppliers.'),L('전공정','Front-end'))}<section class="container chamber-section">${processStrip(id)}<div class="chamber-toolbar"><div><h2>${esc(loc(ch.name))} <span class="small">${id==='etch'?'Etch':'CVD / ALD'}</span></h2></div>${data.suppliers.sample?`<span class="badge">${L('예시 데이터','Sample data')}</span>`:''}</div><div class="chamber-workspace"><div class="diagram-card"><div class="diagram-label">${ch.subtitle} · CROSS SECTION</div><div class="diagram-preview" role="status"></div>${chamberSVG(ch,data.materials,lang)}<div class="legend">${ch.legend.map(g=>`<span><i class="dot ${g.color}"></i>${esc(g.label)}</span>`).join('')}</div><p class="diagram-hint">${L('색 점이나 부품을 누르면 사용 가능한 소재가 열립니다.','Select a colored dot or component to explore available materials.')}</p><div class="part-picker" aria-label="${L('부품 목록에서 선택','Select a component from the list')}">${ch.parts.filter((p,i,a)=>p.materials.length&&a.findIndex(o=>o.name===p.name)===i).map(p=>`<button data-select-part="${p.id}">${esc(p.name)}</button>`).join('')}</div></div><button class="sheet-scrim" data-action="close-explorer" tabindex="-1" aria-label="${L('부품 탐색 닫기','Close part explorer')}"></button><div class="explorer-stage" id="explorer-stage"><div class="explorer-empty">${icon('link')}<span class="eyebrow">YOUR NEXT SOURCE STARTS HERE</span><h3>${L('부품 하나에서<br>새로운 연결로','One component.<br>A new connection.')}</h3><p>${L('왼쪽 구조도에서 필요한 부품을 선택하세요. 해당 부품에 맞는 소재와 공급사를 보여 드립니다.','Select a component in the diagram to discover its available materials and suppliers.')}</p><div class="explorer-steps"><span>01 ${L('부품','Part')}</span>→<span>02 ${L('소재','Material')}</span>→<span>03 ${L('공급사','Supplier')}</span></div></div></div></div><div class="usage-guide" aria-label="${L('이용 안내','How to use')}">${[[L('① 공정 선택','① Process'),L('8대 공정에서 식각 또는 증착을 선택하세요.','Choose etch or deposition from the process strip.')],[L('② 부품 선택','② Component'),L('구조도에서 부품을 누르세요. 색 점은 소재 종류를 뜻합니다.','Select a component. Colored dots identify material families.')],[L('③ 소재 확인','③ Material'),L('선택한 부품에 사용할 수 있는 소재를 살펴보세요.','Explore materials available for that component.')],[L('④ 공급사 확인','④ Supplier'),L('소재를 선택하면 공급사 목록이 열립니다.','Choose a material to view supplier options.')],[L('⑤ 상세·연결','⑤ Connect'),L('공급사 정보를 살펴보고 상세 안내를 받아보세요.','Review the supplier and continue to more details.')]].map(([a,b])=>`<div><b>${a}</b><p>${b}</p></div>`).join('')}</div></section>`;
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
 let html=`<section class="explorer-panel level-1" role="dialog" aria-labelledby="panel-title-1">${panelHead(1,'Available Material')}<div class="panel-body"><p class="panel-context">${esc(part.name)}</p>${mats.map(m=>`<button class="material-option" data-material="${m.id}" aria-pressed="${m.id===explorer.material}"><i class="dot ${m.color}"></i>${esc(m.name)}<span class="arrow" aria-hidden="true">→</span></button>`).join('')}</div></section>`;
 if(mat) html+=`<section class="explorer-panel level-2" role="dialog" aria-labelledby="panel-title-2">${panelHead(2,`Material: ${mat.name}`)}<div class="panel-body"><button class="panel-back" data-back="1">← ${L('소재 다시 선택','Back to materials')}</button>${supplierList.map(s=>`<button class="supplier-option" data-supplier="${s.id}" aria-pressed="${s.id===explorer.supplier}"><span>${esc(s.name)}<small>${L('가능 부품 수','Available parts')} ${s.availableParts}ea</small><small>Supplying to '${s.customers[0]}' Company</small></span><span class="arrow" aria-hidden="true">→</span></button>`).join('')||`<p>${L('이 소재의 공급사 정보는 상담으로 안내합니다.','Contact us for suppliers of this material.')}</p>`}</div></section>`;
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
  // These are real catalog references, not verified supplier inventory. Suppliers are sample data.
  if(!examples.length) examples=rows;
  html+=`<section class="explorer-panel level-3" role="dialog" aria-labelledby="panel-title-3">${panelHead(3,`Supplier Name: ${supplier.id}`)}<div class="panel-body"><button class="panel-back" data-back="2">← ${L('공급사 다시 선택','Back to suppliers')}</button><dl class="supplier-facts"><div><dt>Establishment</dt><dd>${esc(supplier.establishment)}</dd></div><div><dt>Location</dt><dd>${esc(supplier.location)}</dd></div><div><dt>No. of available parts</dt><dd>${supplier.availableParts}ea</dd></div><div><dt>Key Customers</dt><dd>${supplier.customers.map(esc).join(', ')}</dd></div></dl><p class="panel-context">${L('카탈로그 품번 예시','Catalog part number examples')}</p><ul class="part-examples">${examples.slice(0,5).map(r=>`<li>${esc(r.oem)} · ${esc(r.partNo)}</li>`).join('')}</ul><button class="btn primary block" data-action="more-detail">More detail ${arrow}</button></div></section>`;
 }
 stage.innerHTML=html;
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
 if(stage) stage.innerHTML=`<div class="explorer-empty">${icon('link')}<span class="eyebrow">YOUR NEXT SOURCE STARTS HERE</span><h3>${L('다음 부품을 살펴보세요.','Explore your next component.')}</h3><p>${L('구조도에서 부품을 선택하면 소재와 공급사를 보여 드립니다.','Select a component to explore its materials and suppliers.')}</p></div>`;
 document.querySelector(`[data-part="${id}"]`)?.focus({preventScroll:true});
}
function backPage() {
 return `${pageHead('BACK-END PROCESSES',L('공정의 마지막까지 이어지는 연결','Connections through the final process'),L('테스트·패키징 부품 정보를 준비하고 있습니다.','Information on test and packaging components is on its way.'),L('후공정','Back-end'))}<section class="section container"><div class="future-grid">${[['test',L('테스트 공정','Test process'),L('웨이퍼·칩 테스트에 필요한 부품을 소개할 예정입니다.','Explore components for wafer and chip testing here soon.')],['package',L('패키징 공정','Packaging process'),L('패키징 공정 부품을 소개할 예정입니다.','Explore packaging process components here soon.')]].map(([i,t,p])=>`<article class="future-card"><div class="step-icon">${icon(i)}</div><span class="badge">${L('준비 중','Coming soon')}</span><h3>${t}</h3><p>${p}</p></article>`).join('')}</div></section><section class="section container">${cta()}</section>`;
}
const field=(name,label,type='text',required=false,value='',placeholder='')=>`<div class="field"><label for="contact-${name}">${label}${required?'<span class="required" aria-hidden="true">*</span>':''}</label><input id="contact-${name}" name="${name}" type="${type}" ${required?'required':''} ${name==='quantity'?'min="1" step="1"':''} value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="${type==='email'?254:200}" ${['email','name','phone','company'].includes(name)?`autocomplete="${{email:'email',name:'name',phone:'tel',company:'organization'}[name]}"`:''}></div>`;
function contactPage(params) {
 const c=data.company;
 return `${pageHead('LET’S CONNECT',L('필요한 부품을 알려 주세요.','Tell us what you need.'),L('품번 하나, 도면 한 장에서 더 나은 공급을 시작합니다.','A part number or drawing is all it takes to start the conversation.'),L('문의하기','Contact'))}<section class="section container"><div class="form-layout"><aside class="contact-aside"><span class="eyebrow">PARTS & SOURCING</span><h2>${L('적합한 공급원을<br>함께 찾습니다.','Let’s find your<br>next source.')}</h2><p>${L('찾는 부품과 공정 정보를 남겨 주세요.<br>샘플·소량 시험 주문도 상담할 수 있습니다.','Share your part and process requirements.<br>Evaluation samples and small trial orders are welcome.')}</p><div class="contact-details"><div><span>${L('이메일','Email')}</span><a href="mailto:${c.email}">${c.email}</a></div><div><span>${L('전화','Phone')}</span><a href="tel:${c.phone.replaceAll('-','')}">${c.phone}</a></div><div><span>${L('담당자','Contact')}</span>Theo Jeon · SEMILAB GLOBAL</div></div></aside><div class="form-card"><form data-form="contact"><div class="form-grid">${field('company',L('회사명','Company'),'text',true)}${field('name',L('담당자','Name'),'text',true)}${field('email',L('업무 이메일','Work email'),'email',true)}${field('phone',L('전화','Phone'),'tel',true)}${field('part',L('관심 품목·품번','Part or part number'),'text',false,params.get('part')||'',L('예: 0010-03840','e.g. 0010-03840'))}${field('quantity',L('수량','Quantity'),'number',false)}<div class="field full"><label for="contact-message">${L('문의 내용','Message')}<span class="required" aria-hidden="true">*</span></label><textarea id="contact-message" name="message" required maxlength="6000" placeholder="${L('사용 장비, 공정, 필요한 부품을 알려 주세요.','Tell us about your tool, process and part requirements.')}"></textarea></div></div><label class="check-row"><input type="checkbox" name="privacy" required><span>${L('상담을 위한 개인정보 수집·이용에 동의합니다.','I consent to the collection and use of my information for this inquiry.')} <a href="#/privacy" target="_blank" rel="noopener">${L('자세히 보기','Read more')}</a><br>${L('입력하신 정보는 상담과 회신에 사용됩니다.','The information you provide is used to respond to your inquiry.')}</span></label><div class="form-error" role="alert" hidden></div><button class="btn primary block" type="submit">${L('이메일로 상담 신청','Send inquiry by email')}${arrow}</button><p class="form-note">${L('기본 메일 앱이 열립니다. 메일 앱에서 내용을 확인한 뒤 전송해 주세요.','Your default email app will open. Review the message and send it from your email app.')}</p><div class="contact-result" aria-live="polite"></div></form></div></div></section>`;
}
function loginPage(params) {
 return `${pageHead('WELCOME TO SEMI LINK',L('다음 연결을 시작하세요.','Your next connection starts here.'),'',L('로그인','Log in'))}<section class="section container"><div class="auth-wrap"><div class="form-card"><div class="auth-title"><h2>${L('로그인','Log in')}</h2><p>${L('업무 이메일로 로그인하세요.','Sign in with your work email.')}</p></div>${auth.isLoggedIn()?`<p>${L('로그인되어 있습니다.','You are signed in.')}</p>${button('#/front/etch',L('부품 탐색 시작','Explore parts'),'primary')}`:loginForm('page')}<div class="auth-links">${L('아직 회원이 아니신가요?','New to SEMI LINK?')}<a href="#/signup${params.get('return')?'?return='+encodeURIComponent(params.get('return')):''}">${L('회원가입','Sign up')}</a></div></div></div></section>`;
}
function signupPage() {
 return `${pageHead('JOIN THE CONNECTION',L('새로운 공급의 기회를 만나세요.','Discover new sourcing possibilities.'),'',L('회원가입','Sign up'))}<section class="section container"><div class="auth-wrap"><div class="form-card"><div class="auth-title"><h2>${L('회원가입','Create an account')}</h2><p>${L('SEMI LINK와 연결을 시작하세요.','Start connecting with SEMI LINK.')}</p></div><form data-form="signup">${field('company',L('회사명','Company'),'text',true)}${field('name',L('이름','Name'),'text',true)}${field('email',L('업무 이메일','Work email'),'email',true)}<div class="field"><label for="signup-password">${L('비밀번호','Password')}</label><input id="signup-password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="${L('8자 이상 입력해 주세요.','At least 8 characters')}"></div><div class="field"><label for="member-type">${L('회원 유형','Account type')}</label><select id="member-type" name="memberType" required><option value="buyer">${L('구매사','Buyer')}</option><option value="supplier">${L('공급사','Supplier')}</option></select></div><label class="check-row"><input name="terms" type="checkbox" required><span><a href="#/terms" target="_blank" rel="noopener">${L('이용약관','Terms of use')}</a>${L('에 동의합니다.',' — I agree.')}</span></label><label class="check-row"><input name="privacy" type="checkbox" required><span><a href="#/privacy" target="_blank" rel="noopener">${L('개인정보 수집·이용','Privacy policy')}</a>${L('에 동의합니다.',' — I agree.')}</span></label><div class="form-error" role="alert" hidden></div><button class="btn primary block" type="submit">${L('회원가입','Create account')}${arrow}</button></form><div class="auth-links">${L('이미 회원이신가요?','Already a member?')}<a href="#/login">${L('로그인','Log in')}</a></div></div></div></section>`;
}
function legalPage(type) {
 const privacy=type==='privacy';
 return `${pageHead('SEMI LINK',privacy?L('개인정보처리방침','Privacy policy'):L('이용약관','Terms of use'),'',L('이용 안내','Information'))}<section class="section container"><div class="legal-box"><span class="badge">${L('준비 중','Coming soon')}</span><h2 style="margin-top:20px">${L('상세 내용을 준비하고 있습니다.','Detailed information is on its way.')}</h2><p>${privacy?L('개인정보 처리에 관한 문의는 아래 이메일로 보내 주세요.','Please contact us by email with any questions about privacy.'):L('서비스 이용에 관한 문의는 아래 이메일로 보내 주세요.','Please email us with any questions about using the service.')}</p><p><a class="text-link" href="mailto:${data.company.email}">${data.company.email}</a></p></div></section>`;
}
function notFound() {return `${pageHead('SEMI LINK',L('페이지를 찾을 수 없습니다.','Page not found.'),L('주소를 확인하거나 첫 화면에서 다시 시작해 주세요.','Check the address or return to the home page.'))}<section class="section container"><div class="button-row">${button('#/',L('첫 화면으로','Return home'),'primary')}</div></section>`;}

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
 openModal(L('프리미엄 회원 전용','For premium members'),`<div class="premium-mark">${icon('lock')}</div><p>${L('공급사 연락처와 견적 요청은 프리미엄 회원에게 제공됩니다.','Supplier contacts and quotation requests are available to premium members.')}</p><div class="button-row"><button class="btn primary" data-action="subscribe">${L('프리미엄 구독하기','Subscribe to premium')}</button>${button(`#/contact?part=${encodeURIComponent(selectedPart()?.name||'')}`,L('상담 신청','Contact us'),'outline')}</div>`);
}
function moreDetail() {
 if(auth.isLoggedIn())return showPremium();
 openModal(L('로그인이 필요합니다.','Please log in to continue.'),`<p style="margin-bottom:22px">${L('로그인 후 공급사 상세 안내를 확인하세요.','Log in to continue to supplier details.')}</p>${loginForm('modal')}<div class="auth-links">${L('아직 회원이 아니신가요?','New to SEMI LINK?')}<a href="#/signup?return=${encodeURIComponent(location.hash)}">${L('회원가입','Sign up')}</a></div>`,showPremium);
}
function showPaymentNotice() {
 openModal(L('프리미엄 구독 안내','Premium subscription'),`<p>${L('결제 기능 준비 중입니다. 상담 신청으로 안내해 드립니다.','Payment is coming soon. Please contact us for subscription guidance.')}</p><div class="button-row">${button('#/contact',L('상담 신청','Contact us'),'primary')}</div>`);
}
function animateCounters() {
 if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;observer.unobserve(entry.target);
  const el=entry.target;const final=el.dataset.value;const isRange=final.includes('–');const targets=final.split('–').map(Number);const start=performance.now();
  const tick=now=>{if(!el.isConnected)return;const p=Math.min(1,(now-start)/650);el.textContent=targets.map(v=>Math.round(v*(1-(1-p)**3))).join(isRange?'–':'');if(p<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);
 }),{threshold:.5});
 document.querySelectorAll('[data-counter]').forEach(el=>observer.observe(el));
 return ()=>observer.disconnect();
}
function bindPage() {
 const cleanups=[];
 // Optional client-supplied hero images leave the gradient illustration intact on failure.
 document.querySelectorAll('[data-optional-image]').forEach(img=>{const hide=()=>{img.hidden=true;};img.addEventListener('error',hide,{once:true});if(img.complete&&!img.naturalWidth)hide();});
 const stopCounter=animateCounters();if(stopCounter)cleanups.push(stopCounter);
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
  const title=typeof result==='object'?result.cat.name:titles()[path]||L('페이지를 찾을 수 없습니다.','Page not found');
  document.title=`${title} | SEMI LINK`;
  if(typeof result==='object'){catalogRows=result.rows;currentCategory=result.cat;catalogState={query:'',oem:'',size:'',page:1};}
  main.innerHTML=`<div class="route-enter">${typeof result==='object'?result.html:result}</div>`;
  pageCleanup=bindPage();
  if(!preserveScroll){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}else window.scrollTo({top:scroll,behavior:'instant'});
 } catch(error) {
  if(version!==routeVersion)return;
  console.error('Page loading failed:',error);
  main.innerHTML=`<div class="fatal"><h1>${L('페이지를 불러오지 못했습니다.','Unable to load this page.')}</h1><p>${L('잠시 후 다시 시도해 주세요.','Please try again in a moment.')}</p><button class="btn primary" data-action="retry">${L('다시 시도','Try again')}</button></div>`;
 }
}

// Central navigation and interaction handlers also cover content inserted after routing.
document.addEventListener('click',async event=>{
 const target=event.target.closest('a,button,[data-part]');if(!target)return;
 if(target.classList.contains('skip-link')){event.preventDefault();main.focus({preventScroll:true});main.scrollIntoView({behavior:'instant'});return;}
 if(target.matches('a[href^="#/"]')){closeModal(false);header.querySelector('.primary-nav')?.classList.remove('expanded');header.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');const toggle=header.querySelector('.menu-toggle');if(toggle)toggle.textContent='☰';if(target.hash===location.hash){event.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}return;}
 if(target.dataset.page){catalogState.page=Number(target.dataset.page);renderCatalog();document.querySelector('.table-scroll')?.focus({preventScroll:true});return;}
 const partId=target.dataset.part||target.dataset.selectPart;
 if(partId){explorer={part:partId,material:null,supplier:null};await renderPanels();return;}
 if(target.dataset.material){explorer.material=target.dataset.material;explorer.supplier=null;await renderPanels();return;}
 if(target.dataset.supplier){explorer.supplier=target.dataset.supplier;await renderPanels();return;}
 if(target.dataset.back){if(target.dataset.back==='1')explorer.material=null;explorer.supplier=null;await renderPanels();return;}
 const action=target.dataset.action;
 if(action==='menu'){const expanded=target.getAttribute('aria-expanded')!=='true';target.setAttribute('aria-expanded',expanded);header.querySelector('.primary-nav').classList.toggle('expanded',expanded);target.textContent=expanded?'×':'☰';}
 if(action==='front-menu'){const expanded=target.getAttribute('aria-expanded')!=='true';target.setAttribute('aria-expanded',expanded);target.parentElement.classList.toggle('open',expanded);}
 if(action==='language'){lang=lang==='ko'?'en':'ko';safeStorage(storage,'semilink.language',lang);await render({preserveScroll:true});}
 if(action==='logout'){auth.logout();await render({preserveScroll:true});toast(L('로그아웃되었습니다.','You are now signed out.'));}
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
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('[data-form]'))return;event.preventDefault();if(!form.reportValidity())return;
 const values=Object.fromEntries(new FormData(form));
 const err=form.querySelector('.form-error');if(err)err.hidden=true;
 if(form.dataset.form==='login') {
  const result=auth.login(values);
  form.querySelector('[name="password"]').value='';
  if(!result.ok){err.textContent=result.reason==='membership'?L('회원가입 후 로그인해 주세요.','Please create an account before logging in.'):L('이메일과 비밀번호를 입력해 주세요.','Enter your email and password.');err.hidden=false;return;}
  const callback=modalOnSuccess;
  if(callback){closeModal(false);nav();callback();}else{const {params}=routeInfo(location.hash);if(routeInfo(location.hash).path==='/login')location.hash=safeReturn(params);else await render({preserveScroll:true});toast(L('로그인되었습니다.','You are now signed in.'));}
 }
 if(form.dataset.form==='signup') {
  const result=auth.signup(values);
  if(!result.ok){err.textContent=L('입력 내용과 동의 항목을 확인해 주세요.','Please check your details and required agreements.');err.hidden=false;return;}
  form.querySelector('[name="password"]').value='';
  const {params}=routeInfo(location.hash);location.hash=safeReturn(params);toast(L('회원가입이 완료되었습니다.','Your account is ready.'));
 }
 if(form.dataset.form==='contact') {
  try{const {url}=submitContact(values,data.company.email);const result=form.querySelector('.contact-result');result.innerHTML=`<div class="form-success">${L('상담 메일을 준비했습니다. 메일 앱에서 전송하면 신청이 완료됩니다. 메일 앱이 열리지 않으면 아래 주소로 직접 보내 주세요.','Your inquiry email is ready. Send it from your email app to complete your request. If the app did not open, email us directly.')}<br><a href="${esc(url)}">${L('메일 앱 다시 열기','Open email app again')}</a> · <a href="mailto:${data.company.email}">${data.company.email}</a></div>`;window.location.href=url;}
  catch(error){err.textContent=L('신청 메일을 열지 못했습니다. 이메일로 문의해 주세요.','Unable to open the inquiry email. Please contact us by email.');err.hidden=false;}
 }
});
window.addEventListener('hashchange',()=>{if(data)render();});
window.addEventListener('storage',event=>{if(event.key==='semilink.session'&&data)nav();});
try {
 const keys=['company','categories','processes','chambers','materials','suppliers','material-groups','technical-specs'];
 const values=await Promise.all(keys.map(key=>getJSON(`data/${key}.json`)));
 data=Object.fromEntries(keys.map((key,i)=>[key==='material-groups'?'materialGroups':key==='technical-specs'?'technicalSpecs':key,values[i]]));
 await render();
} catch(error) {
 console.error('Site initialization failed:',error);
 main.innerHTML=`<div class="fatal"><h1>${L('페이지를 불러오지 못했습니다.','Unable to load this page.')}</h1><p>${L('인터넷 연결을 확인한 뒤 새로고침해 주세요.','Check your connection and reload the page.')}</p></div>`;
}
