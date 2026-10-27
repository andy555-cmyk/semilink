import {esc} from './utils.js';
export function icon(type, cls = '') {
 const shapes = {
 wafer:'<circle cx="24" cy="24" r="17"/><path d="M10 15h28M7 24h34M10 33h28M15 9v30M24 7v34M33 9v30"/>',
 oxidation:'<path d="M10 32h28v8H10zM13 27c-8-8 7-10 1-18m11 18c-8-8 7-10 1-18m10 18c-8-8 7-10 1-18"/>',
 photo:'<rect x="9" y="17" width="30" height="23" rx="2"/><path d="M15 25h18M15 32h18M24 5v8m-8-7 3 6m13-6-3 6"/>',
 etch:'<path d="M12 13h24v8H12zM8 37h32v5H8zM15 23l-4 10m13-10v10m9-10 4 10M19 5v5m10-5v5"/>',
 deposition:'<path d="m5 18 19-9 19 9-19 9-19-9Zm0 10 19 9 19-9M5 37l19 9 19-9"/>',
 interconnect:'<rect x="13" y="13" width="22" height="22" rx="2"/><path d="M19 5v8m10-8v8M19 35v8m10-8v8M5 19h8m-8 10h8m22-10h8m-8 10h8M19 19h10v10H19z"/>',
 test:'<rect x="8" y="6" width="29" height="36" rx="3"/><path d="m14 16 3 3 5-6m-8 14 3 3 5-6m4-8h6m-6 13h6"/>',
 package:'<path d="m24 5 18 9v22l-18 9-18-9V14L24 5Zm-18 9 18 9 18-9M24 23v22M15 10l18 9v9"/>',
 search:'<circle cx="21" cy="21" r="12"/><path d="m30 30 12 12"/>',
 link:'<path d="m20 29-3 3a8 8 0 0 1-11-11l9-9a8 8 0 0 1 11 0m-4 7 3-3a8 8 0 0 1 11 11l-9 9a8 8 0 0 1-11 0m0-12 10-10"/>',
 lock:'<rect x="10" y="21" width="28" height="22" rx="3"/><path d="M16 21v-8a8 8 0 0 1 16 0v8M24 30v5"/>',
 grid:'<rect x="7" y="7" width="13" height="13" rx="2"/><rect x="28" y="7" width="13" height="13" rx="2"/><rect x="7" y="28" width="13" height="13" rx="2"/><rect x="28" y="28" width="13" height="13" rx="2"/>'
 };
 return `<svg class="${esc(cls)}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${shapes[type] || shapes.grid}</svg>`;
}
export function waferVisual() {
 return `<svg viewBox="0 0 680 300" fill="none" aria-hidden="true"><defs><linearGradient id="wafer-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9fcff" stop-opacity=".7"/><stop offset=".4" stop-color="#7ec9db" stop-opacity=".1"/><stop offset="1" stop-color="#6dc4cc" stop-opacity=".6"/></linearGradient><pattern id="wafer-cells" width="25" height="25" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="21" height="21" rx="1" stroke="#9cdded" stroke-opacity=".4"/></pattern><clipPath id="wafer-clip"><circle cx="270" cy="170" r="145"/></clipPath></defs><g class="wafer-grid" transform="translate(25 -20)"><g transform="translate(0 65) scale(1 .7) rotate(-22 270 170)"><circle cx="270" cy="176" r="147" fill="#15465c" stroke="#a9dcea" stroke-opacity=".4"/><circle cx="270" cy="170" r="145" fill="url(#wafer-metal)" stroke="#c1eff5"/><g clip-path="url(#wafer-clip)"><path fill="url(#wafer-cells)" d="M100 0h340v340H100z"/></g><path d="M137 115a145 145 0 0 1 245-55" stroke="#dbffff" stroke-width="2"/></g></g><path d="M7 260h515m-447-35h443M460 55v195m50-150v148" stroke="#8bc9d1" stroke-opacity=".14"/><circle cx="510" cy="100" r="4" fill="#7ae0d7"/><path d="M510 100h70" stroke="#7ae0d7" stroke-opacity=".6"/><text x="587" y="104" fill="#b3dee9" font-size="10" letter-spacing="2">PRECISION</text></svg>`;
}
export function chamberSVG(chamber, materials, lang) {
 const colors={red:'#dc6662',green:'#6d9c68',yellow:'#dbaf35'};
 const palettes={silver:['#f0f3f6','#b4c2d0'],graphite:['#627384','#304252'],amber:['#e5c67d','#c6a158'],olive:['#b3c39f','#6c8962'],navy:['#315681','#18365e'],blue:['#76a3c7','#416d99'],ice:['#d8e9f4','#91b9d9'],copper:['#c9a27c','#906944']};
 const rect = s=>`<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="2" fill="url(#ch-${s.fill})" stroke="#3b52654d"/>`;
 return `<svg class="chamber-svg" viewBox="0 0 640 565" role="group" aria-label="${lang==='ko'?'부품을 선택할 수 있는 챔버 구조도':'Interactive chamber diagram'}"><defs>${Object.entries(palettes).map(([id,stops])=>`<linearGradient id="ch-${id}" x2="0" y2="1"><stop stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient>`).join('')}<filter id="partGlow" x="-10%" y="-20%" width="120%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#087f83" flood-opacity=".2"/></filter></defs><path d="M65 50v490h510V50" stroke="#cfdae5" stroke-dasharray="3 5" fill="none"/>${chamber.base.map(rect).join('')}${chamber.parts.map(p=>{
 const s=p.shape;const cs=[...new Set(p.materials.map(id=>materials.find(m=>m.id===id)?.color).filter(Boolean))];
 const isLight=['ice','silver','amber'].includes(s.fill);
 return `<g class="${p.materials.length?'part':'structure'}" ${p.materials.length?`data-part="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.name)} — ${lang==='ko'?'소재 보기':'view materials'}" aria-haspopup="dialog"`:''} ${isLight?'data-light="true"':''}>${rect(s)}${p.ports?Array.from({length:p.ports},(_,i)=>`<circle cx="${s.x+12+i*(s.width-24)/(p.ports-1)}" cy="${s.y+s.height-7}" r="1.5" fill="#294558" opacity=".5"/>`).join(''):''}${p.labels.map((l,i)=>`<text x="${s.x+s.width/2}" y="${s.y+s.height/2-(p.labels.length-1)*7+i*14+4}" text-anchor="middle">${esc(l)}</text>`).join('')}${cs.map((c,i)=>`<circle class="material-dot" cx="${s.x+10+i*17}" cy="${s.y-3}" r="6.5" fill="${colors[c]}"/>`).join('')}<title>${esc(p.name)}</title></g>`;
 }).join('')}${chamber.parts.some(p=>p.id==='lift-left')?'<text x="320" y="472" text-anchor="middle" fill="#45627e" font-size="13">Lift Pins</text><text x="320" y="514" text-anchor="middle" fill="#29435b" font-size="11">Gasket</text>':''}</svg>`;
}
