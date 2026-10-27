/* =====================================================================
   설정 — 계산에 쓰는 숫자는 전부 여기 한 곳에만 둔다.
   데모용 임의 값. 돈 단위는 "만 원".
   계산기 화면과 리포트 화면이 같이 쓴다.
   ===================================================================== */
const SETTINGS = {
  draft: true,                 // true 면 맨 위에 '시안' 띠가 뜬다
  showNormalCase: true,        // 리포트에 '보통 운영 시'를 같이 보일지

  // 면적 → 테이블 수
  nonHallPyeong: 8,            // 주방 5평 + 화장실 3평 (창고 없음)
  pyeongPerTable: 1.5,         // 홀에서 테이블 1개(통로 포함)
  minTables: 12,               // 테이블 12개 이상부터 오픈 가능
  maxTables: 60,

  // 매출: 테이블 1개당 한 달 매출 (오픈 직후 기준)
  salesPerTable: { best: 500, normal: 350 },
  openMonths: 2,               // 오픈 효과가 이어지는 달 수
  afterOpenDrop: { best: 0.15, normal: 0.25 },   // 그 뒤 매출 감소

  zones: [
    { id: 'night',  name: '술집·번화가' },
    { id: 'house',  name: '주택가' },
    { id: 'office', name: '오피스' },
    { id: 'campus', name: '대학가' },
    { id: 'etc',    name: '잘 모름' },
  ],
  sido: ['대구','경북','서울','경기','인천','부산','울산','경남','대전','세종','충북','충남','광주','전북','전남','강원','제주'],

  // 한 달 비용 (모두 매출 대비)
  costRate: { capital: 0.30, local: 0.32 },      // 식재료: 수도권 / 지방
  capitalArea: ['서울','경기','인천'],
  etcRate: 0.05,               // 수수료·공과금·소모품
  laborRate: 0.22,             // 인건비
  rentRate: 0.08,              // 월세를 안 적었을 때
  royaltyRate: 0.03,           // 매출 대비 로열티

  // 초기 투자금. partial = 기존 동종 업종이라 부분 공사가 될 때 값
  invest: [
    { name: '가맹비',          type: 'fixed',     value: 300 },
    { name: '교육비',          type: 'fixed',     value: 300 },
    { name: '인테리어',        type: 'perPyeong', value: 140, partial: 80 },
    { name: '주방 설비',       type: 'fixed',     value: 1500, partial: 400 },
    { name: '테이블·의자',     type: 'perTable',  value: 15 },
    { name: '간판·홍보물', type: 'fixed', value: 300 },
    { name: '이행보증금',      type: 'fixed',     value: 100 },
  ],
  bizTypes: [
    { id: 'meat',  name: '동종 업종', partial: true },
    { id: 'pub',   name: '주점' },
    { id: 'korean',name: '한식' },
    { id: 'cafe',  name: '카페' },
    { id: 'etc',   name: '기타' },
    { id: 'empty', name: '공실' },
  ],
  partialNote: '기존 동종 업종은 부분 공사로 계산했습니다. 실제 비용은 매장마다 달라 현장 확인 뒤 확정됩니다.',

  benefits: ['혜택 안내 문구 예시 1', '혜택 안내 문구 예시 2'],
  phone: '0000-0000',
  months: 36,

  disclaimer: '데모용 임의 값 기준 예상치이며 실제와 다를 수 있습니다.',
};

/* ---------------- 계산 ----------------
   inputs: { area(평), sido, zone, biz, rent(만 원, 없으면 0) } */
function computeReport(inputs){
  const S = SETTINGS;
  const minArea = S.nonHallPyeong + S.minTables*S.pyeongPerTable;   // 26평
  const belowMin = inputs.area < minArea;
  const p = belowMin ? minArea : inputs.area;                         // 작은 매장은 최소 면적 기준으로 계산
  const tables = Math.max(S.minTables, Math.min(S.maxTables, Math.floor((p - S.nonHallPyeong)/S.pyeongPerTable)));
  const biz = S.bizTypes.find(b=>b.id===inputs.biz);
  const partial = !!(biz && biz.partial);
  const costRate = S.capitalArea.includes(inputs.sido) ? S.costRate.capital : S.costRate.local;

  const investRows = S.invest.map(r => {
    const unit = partial && r.partial != null ? r.partial : r.value;
    const v = r.type==='perPyeong' ? unit*p : r.type==='perTable' ? unit*tables : unit;
    const tag = r.type==='perPyeong' ? ` (${p}평)` : r.type==='perTable' ? ` (${tables}조)` : '';
    return [r.name + tag + (partial && r.partial != null ? ' · 부분 공사' : ''), v];
  });
  const invest = investRows.reduce((a,r)=>a+r[1],0);

  const monthOf = sales => {
    const rent = inputs.rent > 0 ? inputs.rent : sales*S.rentRate;
    const m = { sales, food: sales*costRate, etc: sales*S.etcRate, labor: sales*S.laborRate, rent, royalty: sales*S.royaltyRate };
    m.profit = sales - m.food - m.etc - m.labor - m.rent - m.royalty;
    return m;
  };
  const series = key => {
    const peak = tables * S.salesPerTable[key];
    const open = monthOf(peak), m = monthOf(peak*(1-S.afterOpenDrop[key]));
    const out = []; let acc = 0, payback = null;
    for (let i=1;i<=S.months;i++){
      acc += (i <= S.openMonths ? open : m).profit;
      out.push(acc);
      if (payback===null && acc>=invest) payback = i;
    }
    return { open, m, out, payback, total: acc };
  };
  return { inputs, area: p, belowMin, minArea, partial, costRate, tables, invest, investRows, best: series('best'), normal: series('normal') };
}

/* ---------------- 도움 함수 ---------------- */
const won = n => Math.round(n).toLocaleString('ko-KR');
function fmtAxis(v){ return Math.abs(v)>=10000 ? (v/10000).toFixed(v%10000?1:0)+'억' : won(v)+'만'; }
function niceStep(raw){ const p=Math.pow(10,Math.floor(Math.log10(Math.abs(raw)||1))); const n=raw/p; return (n<=1?1:n<=2?2:n<=5?5:10)*p; }

function countUp(el, to, ms=900){
  const start = performance.now();
  const step = () => { const k = Math.max(0, Math.min(1,(performance.now()-start)/ms)); el.textContent = won(to*(1-Math.pow(1-k,3))); if(k<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = won(to); }, ms + 100);   // 화면이 가려져 애니메이션이 멈춰도 최종값은 반드시 찍힌다
}

function toast(t){
  const el = document.createElement('div');
  el.textContent = t;
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#171210;color:#fff;padding:12px 18px;border-radius:999px;font-size:14px;z-index:99;max-width:calc(100% - 32px);text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.25)';
  document.body.appendChild(el); setTimeout(()=>el.remove(), 2600);
}

/* 리포트 링크
   실제 운영: 서버가 신청 한 건마다 알아볼 수 없는 무작위 코드를 만들고, 링크에는 그 코드만 싣는다.
   시안: 서버가 없어서 매장 조건(면적·지역·상권·업종·월세)만 주소 뒤에 붙인다. 이름·전화번호는 절대 싣지 않는다. */
function reportLink(inputs){
  const q = new URLSearchParams({ a: inputs.area, s: inputs.sido, z: inputs.zone, b: inputs.biz||'', r: inputs.rent||0 });
  return 'report.html#' + q.toString();
}
function readReportLink(){
  const q = new URLSearchParams(location.hash.slice(1));
  if (!q.get('a')) return null;
  return { area: +q.get('a'), sido: q.get('s')||'', zone: q.get('z')||'etc', biz: q.get('b')||null, rent: +q.get('r')||0 };
}

/* ---------------- 그래프 ---------------- */
function drawChart(svg, legend, R){
  const W=640,H=340,L=78,Rm=20,T=30,B=44, S=SETTINGS;
  const best=R.best.out, nor=R.normal.out;
  const all=[...best,...(S.showNormalCase?nor:[]),R.invest,0];
  let max=Math.max(...all), min=Math.min(...all);
  const step = niceStep((max-min)/4); max=Math.ceil(max/step)*step; min=Math.floor(min/step)*step;
  const x=i=>L+(W-L-Rm)*(i/(S.months-1)), y=v=>T+(H-T-B)*(1-(v-min)/(max-min));
  const path=a=>a.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
  let g='<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cf1a1a" stop-opacity=".22"/><stop offset="1" stop-color="#cf1a1a" stop-opacity="0"/></linearGradient></defs><g class="grid">';
  for(let v=min;v<=max+1;v+=step){ g+=`<line x1="${L}" x2="${W-Rm}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+6}" text-anchor="end">${fmtAxis(v)}</text>`; }
  [1,12,24,36].forEach(m=>{ if(m<=S.months) g+=`<text x="${x(m-1)}" y="${H-10}" text-anchor="${m===1?'start':m===S.months?'end':'middle'}">${m}개월</text>`; });
  g+='</g>';
  g+=`<path class="area" d="${path(best)} L${x(S.months-1)} ${y(min)} L${x(0)} ${y(min)} Z"/>`;
  if(S.showNormalCase) g+=`<path class="line-n" d="${path(nor)}"/>`;
  g+=`<line class="inv" x1="${L}" x2="${W-Rm}" y1="${y(R.invest)}" y2="${y(R.invest)}"/><text class="inv-t" x="${W-Rm}" y="${y(R.invest)-8}" text-anchor="end">투자금 ${won(R.invest)}만</text>`;
  g+=`<path class="line" d="${path(best)}"/>`;
  const pb=R.best.payback;
  if(pb){ const cx=x(pb-1), cy=y(best[pb-1]); g+=`<circle class="pt" cx="${cx}" cy="${cy}" r="8"/><text class="pt-t" x="${cx+14}" y="${cy+30}">${pb}개월 차 회수!</text>`; }
  svg.innerHTML=g;
  const ln=svg.querySelector('.line'), len=ln.getTotalLength();
  ln.style.strokeDasharray=len; ln.style.strokeDashoffset=len; ln.getBoundingClientRect();
  ln.style.transition='stroke-dashoffset 1.6s ease'; ln.style.strokeDashoffset=0;
  setTimeout(()=>{ ln.style.strokeDashoffset=0; }, 50);
  legend.innerHTML=`<span><i style="background:var(--red)"></i>잘 될 때</span>`+(S.showNormalCase?`<span><i style="background:var(--ink-3)"></i>보통 운영 시</span>`:'')+`<span><i style="background:var(--ink)"></i>초기 투자금</span>`;
}

/* 공통: 시안 띠, 등장 효과 */
document.addEventListener('DOMContentLoaded', () => {
  const bar = document.getElementById('draftBar');
  if (bar && !SETTINGS.draft) bar.remove();
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting){ x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
  document.addEventListener('click', e => { const a = e.target.closest('[data-toast]'); if (a){ e.preventDefault(); toast(a.dataset.toast); } });
});
