const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const ROLES={admin:'Quản trị viên',teacher:'Giáo viên',student:'Sinh viên'};
const TABS={admin:['overview','classes','students','scores','users'],teacher:['overview','students','scores'],student:['overview','scores']};
const EDIT={admin:['classes','students','scores','users'],teacher:['scores'],student:[]};
const CFG={
  classes:{label:'Lớp',cols:[['name','Tên lớp'],['teacher_name','Giáo viên'],['n','Sĩ số']],
    fields:[{k:'name',l:'Tên lớp',req:1},{k:'teacher_id',l:'Giáo viên phụ trách',ref:'users',filter:x=>x.role==='teacher'}]},
  students:{label:'Sinh viên',cols:[['code','Mã SV'],['full_name','Họ tên'],['email','Email'],['class_name','Lớp']],
    fields:[{k:'code',l:'Mã SV',req:1},{k:'full_name',l:'Họ tên',req:1},{k:'email',l:'Email',type:'email'},{k:'class_id',l:'Lớp',ref:'classes'}]},
  scores:{label:'Điểm',cols:[['code','Mã SV'],['full_name','Sinh viên'],['class_name','Lớp'],['subject','Môn học'],['score','Điểm']],
    fields:[{k:'student_id',l:'Sinh viên',ref:'students',req:1},{k:'subject',l:'Môn học',req:1},{k:'score',l:'Điểm (0-10)',type:'number',req:1}]},
  users:{label:'Tài khoản',cols:[['username','Tài khoản'],['full_name','Họ tên'],['role','Vai trò'],['sv','Sinh viên liên kết']],
    fields:[{k:'username',l:'Tài khoản',req:1},{k:'full_name',l:'Họ tên',req:1},{k:'role',l:'Vai trò',req:1,opts:Object.entries(ROLES)},
      {k:'student_id',l:'Liên kết sinh viên (nếu là SV)',ref:'students'},{k:'password',l:'Mật khẩu (tối thiểu 8 ký tự)',type:'password',req:1}]}
};
let me,tab='overview',data={},demo=false,editing=null,D;

/* ---------- API (thật hoặc demo) ---------- */
async function api(m,p,b){
  if(demo)return mock(m,p,b);
  const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||'Lỗi '+r.status);
  return j;
}
const SEED=(()=>{const V=[9,8.5,7,7.5,6,8,5.5,4.5,6.5,8.25,9.5,7.75,3.5,5,4.25,6,7,8.5],S=['Triển khai hệ thống','Cơ sở dữ liệu','Mạng máy tính'];
  const n=['Trần Thị B','Phạm Văn D','Lê Minh E','Hoàng Anh F','Vũ Thu G','Đỗ Quang H'];
  return{users:[{id:1,username:'admin',full_name:'Quản trị viên',role:'admin'},{id:2,username:'gv01',full_name:'Nguyễn Văn A',role:'teacher'},{id:3,username:'gv02',full_name:'Lê Thị C',role:'teacher'},
    {id:4,username:'sv001',full_name:'Trần Thị B',role:'student',student_id:1},{id:5,username:'sv003',full_name:'Lê Minh E',role:'student',student_id:3}],
   classes:[{id:1,name:'DHTI15A',teacher_id:2},{id:2,name:'DHTI15B',teacher_id:3}],
   students:n.map((f,i)=>({id:i+1,code:'SV00'+(i+1),full_name:f,email:`sv00${i+1}@example.com`,class_id:i<3?1:2})),
   scores:V.map((v,i)=>({id:i+1,student_id:Math.floor(i/3)+1,subject:S[i%3],score:v}))}})();
function mock(m,p,b){
  const[t,id]=p.split('/'),u=me;
  if(t==='login'){const x=D.users.find(x=>x.username===b.username&&b.password==='demo123');if(!x)throw new Error('Sai tài khoản hoặc mật khẩu');return x}
  if(t==='logout')return{};
  const cn=i=>(D.classes.find(c=>c.id===i)||{}).name,my=D.classes.filter(c=>c.teacher_id===u.id).map(c=>c.id);
  const ok=s=>u.role==='admin'||(u.role==='teacher'?my.includes(s.class_id):s.id===u.student_id);
  const mine=D.students.find(s=>s.id===u.student_id);
  if(m==='GET'){
    if(t==='users')return D.users;
    if(t==='classes')return D.classes.filter(c=>u.role==='admin'||my.includes(c.id)||(mine&&mine.class_id===c.id))
      .map(c=>({...c,teacher_name:(D.users.find(x=>x.id===c.teacher_id)||{}).full_name,n:D.students.filter(s=>s.class_id===c.id).length}));
    if(t==='students')return D.students.filter(ok).map(s=>({...s,class_name:cn(s.class_id)}));
    if(t==='scores')return D.scores.map(x=>{const s=D.students.find(s=>s.id===x.student_id);return{...x,code:s.code,full_name:s.full_name,class_id:s.class_id,class_name:cn(s.class_id)}}).filter(x=>ok({id:x.student_id,class_id:x.class_id}));
  }
  if(!EDIT[u.role].includes(t))throw new Error('Không đủ quyền');
  const L=D[t],old=id&&L.find(x=>x.id==id);
  if(b)for(const f of CFG[t].fields)if(f.ref||f.type==='number')b[f.k]=b[f.k]===''||b[f.k]==null?null:Number(b[f.k]);
  if(t==='scores'&&![b&&b.student_id,old&&old.student_id].filter(Boolean).every(i=>ok(D.students.find(s=>s.id==i))))throw new Error('Sinh viên không thuộc lớp của bạn');
  if(b&&b.password)delete b.password;
  if(m==='POST')L.push({id:Math.max(0,...L.map(x=>x.id))+1,...b});
  if(m==='PUT')Object.assign(old,b);
  if(m==='DELETE'){D[t]=L.filter(x=>x.id!=id);if(t==='students')D.scores=D.scores.filter(x=>x.student_id!=id)}
  return{ok:1};
}

/* ---------- Dashboard ---------- */
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x.score),0)/a.length:null;
const fmt=n=>n==null?'—':+n.toFixed(2);
const grade=n=>n==null?['—','']:n>=8?['Giỏi','good']:n>=6.5?['Khá','good']:n>=5?['Trung bình','mid']:['Yếu','low'];
const stat=(l,v)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
const panel=(t,h)=>`<div class="card panel"><h3>${t}</h3>${h}</div>`;
const bars=(items,max=10)=>items.length?items.map(([l,v,c])=>`<div class="bar-row"><span title="${esc(l)}">${esc(l)}</span><div class="track"><i class="${c||''}" style="width:${Math.min(100,v/max*100)}%"></i></div><b>${fmt(v)}</b></div>`).join(''):'<p class="empty">Chưa có dữ liệu</p>';
function byClass(){const m={};data.scores.forEach(s=>(m[s.class_name||'Chưa xếp lớp']??=[]).push(s));return Object.entries(m).map(([k,v])=>[k,avg(v),grade(avg(v))[1]])}
function overview(){
  const sc=data.scores,a=avg(sc),r=me.role;
  if(r==='admin'){
    const cnt={'Giỏi':0,'Khá':0,'Trung bình':0,'Yếu':0};sc.forEach(s=>cnt[grade(+s.score)[0]]++);
    const ur=k=>data.users.filter(u=>u.role===k).length;
    return`<div class="stats">${stat('Tài khoản',data.users.length)}${stat('Lớp',data.classes.length)}${stat('Sinh viên',data.students.length)}${stat('Điểm TB toàn trường',fmt(a))}</div>
    <div class="grid2">${panel('Điểm TB theo lớp',bars(byClass()))}
    ${panel('Phân loại học lực (số bài điểm)',bars(Object.entries(cnt).map(([k,v])=>[k,v,'']),Math.max(1,...Object.values(cnt))))}
    ${panel('Tài khoản theo vai trò',bars(Object.keys(ROLES).map(k=>[ROLES[k],ur(k),'']),Math.max(1,data.users.length)))}</div>`;
  }
  if(r==='teacher'){
    const risk=data.students.map(s=>[s,avg(sc.filter(x=>x.student_id===s.id))]).filter(([,v])=>v!=null&&v<5);
    return`<div class="stats">${stat('Lớp phụ trách',data.classes.length)}${stat('Sinh viên',data.students.length)}${stat('Bài điểm',sc.length)}${stat('Điểm TB',fmt(a))}</div>
    <div class="grid2">${panel('Điểm TB theo lớp của tôi',bars(byClass()))}
    ${panel('Sinh viên cần chú ý (TB dưới 5)',risk.length?`<ul class="risk">${risk.map(([s,v])=>`<li><span>${esc(s.code)} - ${esc(s.full_name)} (${esc(s.class_name)})</span><span class="badge low">${fmt(v)}</span></li>`).join('')}</ul>`:'<p class="empty">Không có sinh viên nào dưới 5</p>')}</div>`;
  }
  const s=data.students[0]||{},v=sc.map(x=>+x.score),g=grade(a);
  return`<div class="card hero"><div class="avatar">${esc((s.full_name||me.full_name)[0])}</div><div><h2>${esc(s.full_name||me.full_name)}</h2>
    <small>${esc(s.code||'')} · Lớp ${esc(s.class_name||'—')} · ${esc(s.email||'')}</small></div><span class="badge ${g[1]}">Xếp loại: ${g[0]}</span></div>
    <div class="stats">${stat('Điểm trung bình',fmt(a))}${stat('Cao nhất',fmt(v.length?Math.max(...v):null))}${stat('Thấp nhất',fmt(v.length?Math.min(...v):null))}${stat('Số môn',sc.length)}</div>
    ${panel('Điểm từng môn của tôi',bars(sc.map(x=>[x.subject,+x.score,grade(+x.score)[1]])))}`;
}

/* ---------- Bảng + form ---------- */
const lab=(t,id)=>{const o=data[t].find(x=>x.id==id);return o?(t==='students'?`${o.code} - ${o.full_name}`:t==='classes'?o.name:o.full_name):'—'};
const cell=(k,v)=>k==='score'&&v!=null?`<span class="badge ${grade(+v)[1]}">${+v}</span>`:k==='role'?ROLES[v]:esc(v??'—');
function render(){
  $('#tabs').innerHTML=TABS[me.role].map(k=>`<button class="tab${k===tab?' on':''}" data-tab="${k}">${k==='overview'?'Tổng quan':CFG[k].label}</button>`).join('');
  const ov=tab==='overview';$('#dash').hidden=!ov;$('#list').hidden=ov;
  if(ov){$('#dash').innerHTML=overview();return}
  const c=CFG[tab],can=EDIT[me.role].includes(tab),q=$('#q').value.toLowerCase();
  $('#add').hidden=!can;
  $('#head').innerHTML='<tr>'+c.cols.map(x=>`<th>${x[1]}</th>`).join('')+(can?'<th></th>':'')+'</tr>';
  const rows=data[tab].filter(r=>!q||c.cols.some(x=>String(r[x[0]]??'').toLowerCase().includes(q)));
  $('#body').innerHTML=rows.map(r=>'<tr>'+c.cols.map(x=>`<td>${cell(x[0],r[x[0]])}</td>`).join('')+
    (can?`<td class="act"><button class="btn sm" data-act="edit" data-id="${r.id}">Sửa</button> <button class="btn sm del" data-act="del" data-id="${r.id}">Xóa</button></td>`:'')+'</tr>').join('');
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
    return`<label>${f.l}${pw&&id?' (để trống nếu không đổi)':''}</label><input name="${f.k}" type="${f.type||'text'}" value="${pw?'':esc(v)}"${req}${f.type==='number'?' step="0.01" min="0" max="10"':''}${pw?' minlength="8" autocomplete="new-password"':''}>`}).join('');
  $('#dlg').showModal();
}

/* ---------- Luồng chính ---------- */
async function load(){
  const T=['classes','students','scores',...(me.role==='admin'?['users']:[])];
  for(const t of T)data[t]=await api('GET',t);
  data.users?.forEach(u=>u.sv=u.student_id?lab('students',u.student_id):null);
  render();
}
async function run(fn,msg){try{await fn();await load();toast(msg)}catch(e){toast('Lỗi: '+e.message)}}
async function start(){
  $('#login').hidden=true;$('#app').hidden=false;tab='overview';
  $('#who').textContent=me.full_name;$('#role').textContent=ROLES[me.role];$('#mode').hidden=!demo;
  try{await load()}catch(e){toast('Lỗi: '+e.message)}
}
function showLogin(){$('#login').hidden=false;$('#app').hidden=true;$('#err').textContent='';$('#lf').reset()}
async function login(b){try{me=await api('POST','login',b);await start()}catch(e){$('#err').textContent=e.message}}
async function init(){
  try{const r=await fetch('/api/me');
    if(r.ok){me=await r.json();return start()}
    if(r.status===401)return showLogin();
    throw 0;
  }catch{demo=true;D=structuredClone(SEED);$('#quick').hidden=false;showLogin()}
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-act],[data-u]');if(!t)return;
  if(t.dataset.u)login({username:t.dataset.u,password:'demo123'});
  else if(t.dataset.tab){tab=t.dataset.tab;$('#q').value='';render()}
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
init();

