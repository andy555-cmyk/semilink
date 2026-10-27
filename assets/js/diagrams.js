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
 // 단면도 v2: 평면 색·가는 선·여백 위주. 소재가 있는 부품만 누를 수 있다
 const colors={red:'#f06a6a',green:'#3fb68b',yellow:'#f2b33d'};
 const tone={silver:['#f4f6f9','#c9d2de'],graphite:['#e6ebf2','#a7b6c8'],amber:['#fff4df','#e8c37a'],olive:['#edf4e8','#b2c7a5'],navy:['#dfe9f8','#86a4d0'],blue:['#e6f0fd','#98b8e6'],ice:['#eef8fd','#a9d3ea'],copper:['#f8eee4','#d6b393']};
 const box=(s,cls='')=>{const [f,st]=tone[s.fill]||tone.silver;return `<rect class="${cls}" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${Math.min(6,s.height/2)}" fill="${f}" stroke="${st}"/>`;};
 const X0=Math.min(...chamber.base.map(b=>b.x),...chamber.parts.map(p=>p.shape.x))-18,X1=Math.max(...chamber.base.map(b=>b.x+b.width),...chamber.parts.map(p=>p.shape.x+p.shape.width))+18;
 const Y0=Math.min(...chamber.base.map(b=>b.y),...chamber.parts.map(p=>p.shape.y))-18,Y1=Math.max(...chamber.base.map(b=>b.y+b.height),...chamber.parts.map(p=>p.shape.y+p.shape.height))+18;
 const fs=w=>w<60?10.5:w<90?11.5:13;
 return `<svg class="chamber-svg v2" viewBox="0 0 640 565" role="group" aria-label="${lang==='ko'?'부품을 선택할 수 있는 챔버 단면도':'Interactive chamber section'}"><defs><pattern id="sv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="6" stroke="#d3dbe6" stroke-width="1"/></pattern><linearGradient id="sv-sel" x1="0" x2="1"><stop stop-color="#6fb6ff"/><stop offset="1" stop-color="#2456e6"/></linearGradient><linearGradient id="sv-selfill" x1="0" x2="1"><stop stop-color="#e3f9fd"/><stop offset="1" stop-color="#e6eeff"/></linearGradient></defs>
 <rect x="${X0}" y="${Y0}" width="${X1-X0}" height="${Y1-Y0}" rx="22" fill="#fbfcfe" stroke="#e3e9f1"/>
 <line class="sv-axis" x1="320" y1="${Y0+8}" x2="320" y2="${Y1-8}"/>
 ${chamber.base.map(b=>`<g class="sv-base">${box(b)}<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${Math.min(6,b.height/2)}" fill="url(#sv-hatch)" opacity=".7"/></g>`).join('')}
 ${chamber.parts.map(p=>{
  const s=p.shape;const live=p.materials.length>0;const cs=[...new Set(p.materials.map(id=>materials.find(m=>m.id===id)?.color).filter(Boolean))];
  const lines=p.labels;const size=fs(s.width);
  const text=s.height<18?'':lines.map((l,i)=>`<text x="${s.x+s.width/2}" y="${s.y+s.height/2-(lines.length-1)*size*.6+i*size*1.2+size*.36}" font-size="${size}">${esc(l)}</text>`).join('');
  return `<g class="${live?'part':'structure'}" ${live?`data-part="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.name)} — ${lang==='ko'?'소재 보기':'view materials'}" aria-haspopup="dialog"`:''}>${box(s,'sv-body')}${live?`<rect class="sv-ring" x="${s.x-3}" y="${s.y-3}" width="${s.width+6}" height="${s.height+6}" rx="${Math.min(8,s.height/2+3)}"/>`:''}${p.ports?Array.from({length:p.ports},(_,i)=>`<circle cx="${s.x+12+i*(s.width-24)/(p.ports-1)}" cy="${s.y+s.height-8}" r="1.6" class="sv-port"/>`).join(''):''}${text}${live?cs.map((c,i)=>`<circle class="material-dot" cx="${s.x+s.width-6-i*9}" cy="${s.y-7}" r="3.2" fill="${colors[c]}"/>`).join(''):''}<title>${esc(p.name)}</title></g>`;
 }).join('')}
 ${chamber.parts.some(p=>p.id==='lift-left')?'<text class="sv-note" x="320" y="472" text-anchor="middle">Lift Pins</text><text class="sv-note" x="320" y="514" text-anchor="middle">Gasket</text>':''}
 </svg>`;
}
