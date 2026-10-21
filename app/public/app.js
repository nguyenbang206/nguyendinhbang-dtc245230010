const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const ROLES={admin:'Quản trị viên',teacher:'Giáo viên',student:'Sinh viên'};
const TABS={
  admin:['overview','classes','students','scores','users'],
  teacher:['overview','students','scores'],
  student:['overview','scores']
};
const EDIT={admin:['classes','subjects','students','scores','users'],teacher:['scores'],student:[]};
const TAB_ICONS={
  overview:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  classes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  subjects:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/></svg>',
  students:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  scores:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};
const TAB_LABELS={overview:'Tổng quan',classes:'Lớp',subjects:'Môn học',students:'Sinh viên',scores:'Điểm',users:'Tài khoản'};
const CFG={
  classes:{label:'Lớp',cols:[['name','Tên lớp'],['teacher_name','Giáo viên'],['n','Sĩ số']],
    fields:[{k:'name',l:'Tên lớp',req:1},{k:'teacher_id',l:'Giáo viên phụ trách',ref:'users',filter:x=>x.role==='teacher'}]},
  subjects:{label:'Môn học',cols:[['code','Mã môn'],['name','Tên môn học'],['credits','Tín chỉ']],
    fields:[{k:'code',l:'Mã môn',req:1},{k:'name',l:'Tên môn học',req:1},{k:'credits',l:'Số tín chỉ',type:'number',req:1}]},
  students:{label:'Sinh viên',cols:[['code','Mã SV'],['full_name','Họ tên'],['email','Email'],['class_name','Lớp']],
    fields:[{k:'code',l:'Mã SV',req:1},{k:'full_name',l:'Họ tên',req:1},{k:'email',l:'Email',type:'email'},{k:'class_id',l:'Lớp',ref:'classes'}]},
  scores:{label:'Điểm',cols:[['code','Mã SV'],['full_name','Sinh viên'],['class_name','Lớp'],['subject','Môn học'],['score','Điểm']],
    fields:[{k:'student_id',l:'Sinh viên',ref:'students',req:1},{k:'subject',l:'Môn học',req:1},{k:'score',l:'Điểm (0-10)',type:'number',req:1}]},
  users:{label:'Tài khoản',cols:[['username','Tài khoản'],['full_name','Họ tên'],['role','Vai trò'],['sv','Sinh viên liên kết']],
    fields:[{k:'username',l:'Tài khoản',req:1},{k:'full_name',l:'Họ tên',req:1},{k:'role',l:'Vai trò',req:1,opts:Object.entries(ROLES)},
      {k:'student_id',l:'Liên kết sinh viên (nếu là SV)',ref:'students'},{k:'password',l:'Mật khẩu (tối thiểu 8 ký tự)',type:'password',req:1}]}
};
let me,tab='overview',data={},editing=null;

/* ===== THEME ===== */
function initTheme(){
  const saved=localStorage.getItem('theme');
  const theme=saved||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  setTheme(theme);
}
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('theme',t);
  const label=$('.theme-label');
  if(label) label.textContent=t==='dark'?'Chế độ tối':'Chế độ sáng';
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  setTheme(cur==='dark'?'light':'dark');
}
initTheme();

/* ===== API ===== */
async function api(m,p,b){
  const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||'Lỗi '+r.status);
  return j;
}
/* ===== Canvas Chart Helpers ===== */
const CHART_COLORS=['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16'];

function drawBarChart(canvasId, labels, values, colors){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const w=canvas.parentElement.clientWidth;
  const h=220;
  canvas.width=w*dpr; canvas.height=h*dpr;
  canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.scale(dpr,dpr);

  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const textColor=isDark?'#a0a8c0':'#545a72';
  const gridColor=isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)';

  const pad={top:20,right:20,bottom:40,left:50};
  const cw=w-pad.left-pad.right;
  const ch=h-pad.top-pad.bottom;
  const max=Math.max(...values,1)*1.15;
  const barW=Math.min(40,cw/labels.length*.6);
  const gap=(cw-barW*labels.length)/(labels.length+1);

  // Grid
  ctx.strokeStyle=gridColor;
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.top+ch-ch*(i/4);
    ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(w-pad.right,y);ctx.stroke();
    ctx.fillStyle=textColor;ctx.font='11px Inter,sans-serif';ctx.textAlign='right';
    ctx.fillText((max*i/4).toFixed(1),pad.left-8,y+4);
  }

  // Bars with animation
  labels.forEach((l,i)=>{
    const x=pad.left+gap+(barW+gap)*i;
    const barH=(values[i]/max)*ch;
    const y=pad.top+ch-barH;
    const col=colors?colors[i]:CHART_COLORS[i%CHART_COLORS.length];

    // Shadow
    ctx.save();
    ctx.shadowColor=col+'40';
    ctx.shadowBlur=12;
    ctx.shadowOffsetY=4;

    // Rounded bar
    const r=Math.min(6,barW/3);
    ctx.beginPath();
    ctx.moveTo(x,pad.top+ch);
    ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r);
    ctx.lineTo(x+barW-r,y);
    ctx.arcTo(x+barW,y,x+barW,y+r,r);
    ctx.lineTo(x+barW,pad.top+ch);
    ctx.closePath();

    // Gradient fill
    const grd=ctx.createLinearGradient(x,y,x,pad.top+ch);
    grd.addColorStop(0,col);
    grd.addColorStop(1,col+'88');
    ctx.fillStyle=grd;
    ctx.fill();
    ctx.restore();

    // Value on top
    ctx.fillStyle=textColor;ctx.font='bold 11px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(values[i].toFixed(1),x+barW/2,y-6);

    // Label
    ctx.fillStyle=textColor;ctx.font='11px Inter,sans-serif';
    const label=l.length>8?l.slice(0,7)+'…':l;
    ctx.fillText(label,x+barW/2,pad.top+ch+18);
  });
}

function drawDonutChart(canvasId, labels, values, colors){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const size=Math.min(canvas.parentElement.clientWidth, 280);
  canvas.width=size*dpr; canvas.height=size*dpr;
  canvas.style.width=size+'px'; canvas.style.height=size+'px';
  ctx.scale(dpr,dpr);

  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const bgColor=isDark?'#1a1f35':'#ffffff';
  const textColor=isDark?'#e8ecf5':'#1a1d2e';

  const cx=size/2, cy=size/2, outerR=size/2-10, innerR=outerR*.58;
  const total=values.reduce((a,b)=>a+b,0)||1;
  let angle=-Math.PI/2;

  values.forEach((v,i)=>{
    const sliceAngle=(v/total)*Math.PI*2;
    const col=colors?colors[i]:CHART_COLORS[i%CHART_COLORS.length];

    ctx.beginPath();
    ctx.arc(cx,cy,outerR,angle,angle+sliceAngle);
    ctx.arc(cx,cy,innerR,angle+sliceAngle,angle,true);
    ctx.closePath();
    ctx.fillStyle=col;
    ctx.fill();

    // Label on slice
    if(v>0){
      const midAngle=angle+sliceAngle/2;
      const lr=(outerR+innerR)/2;
      const lx=cx+Math.cos(midAngle)*lr;
      const ly=cy+Math.sin(midAngle)*lr;
      const pct=Math.round(v/total*100);
      if(pct>=8){
        ctx.fillStyle='#fff';ctx.font='bold 11px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(pct+'%',lx,ly);
      }
    }
    angle+=sliceAngle;
  });

  // Center circle
  ctx.beginPath();ctx.arc(cx,cy,innerR-2,0,Math.PI*2);
  ctx.fillStyle=bgColor;ctx.fill();

  // Center text
  ctx.fillStyle=textColor;ctx.font='bold 22px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(total,cx,cy-6);
  ctx.font='11px Inter,sans-serif';ctx.fillStyle=isDark?'#6b7394':'#8891a8';
  ctx.fillText('Tổng',cx,cy+12);
}

function drawHorizontalBarChart(canvasId, labels, values, colors){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const w=canvas.parentElement.clientWidth;
  const barH=28;
  const gap=10;
  const h=labels.length*(barH+gap)+30;
  canvas.width=w*dpr; canvas.height=h*dpr;
  canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.scale(dpr,dpr);

  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const textColor=isDark?'#a0a8c0':'#545a72';
  const trackColor=isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.04)';

  const pad={left:100,right:60};
  const cw=w-pad.left-pad.right;
  const max=Math.max(...values,1)*1.15;

  labels.forEach((l,i)=>{
    const y=i*(barH+gap)+10;
    const col=colors?colors[i]:CHART_COLORS[i%CHART_COLORS.length];
    const barW=(values[i]/max)*cw;

    // Track
    ctx.fillStyle=trackColor;
    ctx.beginPath();
    roundRect(ctx,pad.left,y,cw,barH,6);
    ctx.fill();

    // Bar with gradient
    const grd=ctx.createLinearGradient(pad.left,0,pad.left+barW,0);
    grd.addColorStop(0,col);
    grd.addColorStop(1,col+'aa');
    ctx.fillStyle=grd;
    ctx.beginPath();
    roundRect(ctx,pad.left,y,Math.max(barW,8),barH,6);
    ctx.fill();

    // Label
    ctx.fillStyle=textColor;ctx.font='12px Inter,sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
    const label=l.length>12?l.slice(0,11)+'…':l;
    ctx.fillText(label,pad.left-10,y+barH/2);

    // Value
    ctx.fillStyle=textColor;ctx.font='bold 12px Inter,sans-serif';ctx.textAlign='left';
    ctx.fillText(values[i]%1===0?values[i].toString():values[i].toFixed(2),pad.left+barW+8,y+barH/2);
  });
}

function roundRect(ctx,x,y,w,h,r){
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
}

function chartLegend(labels, colors){
  return `<div class="chart-legend">${labels.map((l,i)=>`<span class="legend-item"><i style="background:${colors?colors[i]:CHART_COLORS[i%CHART_COLORS.length]}"></i>${esc(l)}</span>`).join('')}</div>`;
}

/* ===== Dashboard ===== */
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x.score),0)/a.length:null;
const fmt=n=>n==null?'—':+n.toFixed(2);
const grade=n=>n==null?['—','']:n>=8?['Giỏi','good']:n>=6.5?['Khá','mid']:n>=5?['Trung bình','mid']:['Yếu','low'];
const STAT_ICONS=['📊','📚','🎒','📈'];
const stat=(l,v,i)=>`<div class="stat"><div class="stat-icon">${STAT_ICONS[i]||'📋'}</div><b>${v}</b><span>${l}</span></div>`;
const panel=(t,h)=>`<div class="card panel"><h3>${t}</h3>${h}</div>`;

let chartIdCounter=0;
function nextChartId(){return 'chart_'+(++chartIdCounter)}

function byClass(){const m={};data.scores.forEach(s=>(m[s.class_name||'Chưa xếp lớp']??=[]).push(s));return Object.entries(m).map(([k,v])=>[k,avg(v)])}

function overview(){
  const sc=data.scores,a=avg(sc),r=me.role;
  chartIdCounter=0;

  if(r==='admin'){
    const cnt={'Giỏi':0,'Khá':0,'Trung bình':0,'Yếu':0};
    sc.forEach(s=>cnt[grade(+s.score)[0]]++);
    const ur=k=>data.users.filter(u=>u.role===k).length;
    const cid1=nextChartId(), cid2=nextChartId(), cid3=nextChartId();
    const gradeColors=['#10b981','#6366f1','#f59e0b','#ef4444'];
    const roleColors=['#ef4444','#6366f1','#10b981'];

    const html=`<div class="stats">${stat('Tài khoản',data.users.length,0)}${stat('Lớp',data.classes.length,1)}${stat('Sinh viên',data.students.length,2)}${stat('Điểm TB toàn trường',fmt(a),3)}</div>
    <div class="grid2">
      ${panel('Điểm TB theo lớp',`<div class="chart-wrap"><canvas id="${cid1}"></canvas></div>`)}
      ${panel('Phân loại học lực',`<div class="chart-wrap" style="display:flex;flex-direction:column;align-items:center"><canvas id="${cid2}"></canvas></div>${chartLegend(Object.keys(cnt),gradeColors)}`)}
      ${panel('Tài khoản theo vai trò',`<div class="chart-wrap" style="display:flex;flex-direction:column;align-items:center"><canvas id="${cid3}"></canvas></div>${chartLegend(Object.values(ROLES),roleColors)}`)}
    </div>`;

    setTimeout(()=>{
      const bc=byClass();
      drawBarChart(cid1,bc.map(x=>x[0]),bc.map(x=>x[1]));
      drawDonutChart(cid2,Object.keys(cnt),Object.values(cnt),gradeColors);
      drawDonutChart(cid3,Object.values(ROLES),Object.keys(ROLES).map(k=>ur(k)),roleColors);
    },50);
    return html;
  }

  if(r==='teacher'){
    const risk=data.students.map(s=>[s,avg(sc.filter(x=>x.student_id===s.id))]).filter(([,v])=>v!=null&&v<5);
    const cid1=nextChartId();
    const html=`<div class="stats">${stat('Lớp phụ trách',data.classes.length,0)}${stat('Sinh viên',data.students.length,1)}${stat('Bài điểm',sc.length,2)}${stat('Điểm TB',fmt(a),3)}</div>
    <div class="grid2">
      ${panel('Điểm TB theo lớp của tôi',`<div class="chart-wrap"><canvas id="${cid1}"></canvas></div>`)}
      ${panel('Sinh viên cần chú ý (TB dưới 5)',risk.length?`<ul class="risk">${risk.map(([s,v])=>`<li><span>${esc(s.code)} - ${esc(s.full_name)} (${esc(s.class_name)})</span><span class="badge low">${fmt(v)}</span></li>`).join('')}</ul>`:'<p class="empty">Không có sinh viên nào dưới 5</p>')}
    </div>`;
    setTimeout(()=>{
      const bc=byClass();
      drawBarChart(cid1,bc.map(x=>x[0]),bc.map(x=>x[1]));
    },50);
    return html;
  }

  // Student view
  const s=data.students[0]||{},v=sc.map(x=>+x.score),g=grade(a);
  const cid1=nextChartId();
  const subColors=sc.map((_,i)=>CHART_COLORS[i%CHART_COLORS.length]);
  const html=`<div class="card hero"><div class="avatar">${esc((s.full_name||me.full_name)[0])}</div><div><h2>${esc(s.full_name||me.full_name)}</h2>
    <small>${esc(s.code||'')} · Lớp ${esc(s.class_name||'—')} · ${esc(s.email||'')}</small></div><span class="badge ${g[1]}">Xếp loại: ${g[0]}</span></div>
    <div class="stats">${stat('Điểm trung bình',fmt(a),0)}${stat('Cao nhất',fmt(v.length?Math.max(...v):null),1)}${stat('Thấp nhất',fmt(v.length?Math.min(...v):null),2)}${stat('Số môn',sc.length,3)}</div>
    ${panel('Điểm từng môn của tôi',`<div class="chart-wrap"><canvas id="${cid1}"></canvas></div>`)}`;
  setTimeout(()=>{
    drawBarChart(cid1,sc.map(x=>x.subject),sc.map(x=>+x.score),subColors);
  },50);
  return html;
}

/* ===== Bảng + form ===== */
const lab=(t,id)=>{const o=data[t]?.find(x=>x.id==id);return o?(t==='students'?`${o.code} - ${o.full_name}`:t==='classes'?o.name:o.full_name):'—'};
const cell=(k,v)=>k==='score'&&v!=null?`<span class="badge ${grade(+v)[1]}">${+v}</span>`:k==='role'?ROLES[v]:esc(v??'—');

function render(){
  // Sidebar navigation
  let navHtml='<div class="nav-group"><div class="nav-label">Menu</div>';
  TABS[me.role].forEach(k=>{
    navHtml+=`<button class="tab${k===tab?' on':''}" data-tab="${k}">${TAB_ICONS[k]||''}<span>${TAB_LABELS[k]||CFG[k]?.label||k}</span></button>`;
  });
  navHtml+='</div>';
  $('#tabs').innerHTML=navHtml;

  // Page title
  $('#pageTitle').textContent=tab==='overview'?'Tổng quan':(CFG[tab]?.label||tab);

  const ov=tab==='overview';$('#dash').hidden=!ov;$('#list').hidden=ov;
  if(ov){$('#dash').innerHTML=overview();return}
  const c=CFG[tab],can=EDIT[me.role].includes(tab),q=$('#q').value.toLowerCase();
  $('#add').hidden=!can;
  $('#head').innerHTML='<tr>'+c.cols.map(x=>`<th>${x[1]}</th>`).join('')+(can?'<th></th>':'')+'</tr>';
  const rows=data[tab].filter(r=>!q||c.cols.some(x=>String(r[x[0]]??'').toLowerCase().includes(q)));
  $('#body').innerHTML=rows.map(r=>'<tr>'+c.cols.map(x=>`<td>${cell(x[0],r[x[0]])}</td>`).join('')+
    (can?`<td class="act"><button class="btn sm" data-act="edit" data-id="${r.id}">Sửa</button> <button class="btn sm del" data-act="del" data-id="${r.id}">Xóa</button></td>`:'')+
    '</tr>').join('');
  $('#empty').hidden=rows.length>0;
}

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}

function openForm(id){
  editing=id;const c=CFG[tab],row=id?data[tab].find(x=>x.id==id):{};
  $('#dt').textContent=(id?'Sửa ':'Thêm ')+c.label.toLowerCase();
  $('#fields').innerHTML=c.fields.map(f=>{
    const v=row[f.k]??'',pw=f.k==='password',req=f.req&&!(pw&&id)?' required':'';
    if(f.opts||f.ref){const o=f.opts||data[f.ref].filter(x=>!f.filter||f.filter(x)).map(x=>[x.id,lab(f.ref,x.id)]);
      return`<label>${f.l}</label><select name="${f.k}"${req}>${f.opts?'':'<option value="">— Chọn —</option>'}${o.map(([a,b])=>`<option value="${esc(a)}"${a==v?' selected':''}>${esc(b)}</option>`).join('')}</select>`}
    if(f.k==='credits')return`<label>${f.l}</label><input name="${f.k}" type="number" value="${esc(v)}" min="1" max="10" step="1"${req}>`;
    return`<label>${f.l}${pw&&id?' (để trống nếu không đổi)':''}</label><input name="${f.k}" type="${f.type||'text'}" value="${pw?'':esc(v)}"${req}${f.type==='number'?' step="0.01" min="0" max="10"':''}${pw?' minlength="8" autocomplete="new-password"':''}>`}).join('');
  $('#dlg').showModal();
}

/* ===== Luồng chính ===== */
async function load(){
  const T=['classes','students','scores',...(me.role==='admin'?['users']:[])];
  for(const t of T)data[t]=await api('GET',t);
  data.users?.forEach(u=>u.sv=u.student_id?lab('students',u.student_id):null);
  render();
}
async function run(fn,msg){try{await fn();await load();toast(msg)}catch(e){toast('Lỗi: '+e.message)}}
async function start(){
  $('#login').hidden=true;$('#app').hidden=false;tab='overview';
  $('#who').textContent=me.full_name;$('#role').textContent=ROLES[me.role];
  try{await load()}catch(e){toast('Lỗi: '+e.message)}
}
function showLogin(){$('#login').hidden=false;$('#app').hidden=true;$('#err').textContent='';$('#lf').reset()}
async function login(b){try{me=await api('POST','login',b);await start()}catch(e){$('#err').textContent=e.message}}
async function init(){
  try{
    const r=await fetch('/api/me');
    if(r.ok){me=await r.json();return start()}
    if(r.status===401)return showLogin();
    throw new Error('Không thể kiểm tra phiên đăng nhập (HTTP '+r.status+')');
  }catch(e){
    showLogin();
    $('#err').textContent='Không thể kết nối máy chủ: '+e.message;
  }
}

/* ===== Events ===== */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-act]');if(!t)return;
  if(t.dataset.tab){tab=t.dataset.tab;$('#q').value='';render();
    // Close sidebar on mobile
    if(window.innerWidth<=900){$('#sidebar').classList.remove('open');$('#overlay').hidden=true;}
  }
  else if(t.dataset.act==='edit')openForm(t.dataset.id);
  else if(confirm('Bạn chắc chắn muốn xóa?'))run(()=>api('DELETE',`${tab}/${t.dataset.id}`),'Đã xóa');
});

$('#lf').onsubmit=e=>{e.preventDefault();login(Object.fromEntries(new FormData($('#lf'))))};
$('#out').onclick=async()=>{try{await api('POST','logout')}catch{}me=null;data={};showLogin()};
$('#add').onclick=()=>openForm(null);
$('#cancel').onclick=()=>$('#dlg').close();
$('#q').oninput=render;
$('#f').onsubmit=e=>{e.preventDefault();
  const b=Object.fromEntries(new FormData($('#f')));$('#dlg').close();
  run(()=>editing?api('PUT',`${tab}/${editing}`,b):api('POST',tab,b),editing?'Đã cập nhật':'Đã thêm mới');
};

// Theme toggle
$('#themeToggle').onclick=toggleTheme;

// Mobile sidebar
$('#menuBtn').onclick=()=>{$('#sidebar').classList.add('open');$('#overlay').hidden=false;};
$('#overlay').onclick=()=>{$('#sidebar').classList.remove('open');$('#overlay').hidden=true;};

// Redraw charts on resize
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(tab==='overview')render()},200)});

// Add legend styles dynamically
const legendStyle=document.createElement('style');
legendStyle.textContent=`.chart-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;justify-content:center}.legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2)}.legend-item i{width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0}`;
document.head.appendChild(legendStyle);

init();

