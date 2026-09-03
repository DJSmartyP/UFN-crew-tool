import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, runTransaction, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $=s=>document.querySelector(s);
const main=$('#main'), topActions=$('#topActions');
const params=new URLSearchParams(location.search);
const deploymentParam=params.get('m');
const FLEX='__FLEX__';
const FLEX_LABEL='No preference / fill a gap';
const DEFAULT_SINGLE_UFN='UFN Vanguard';
const DEFAULT_DUAL_UFN='UFN Celeste';
const DEFAULT_DUAL_GHOST='GST Darkwater';
const ROLES=[
  {name:'Captain',colour:'command'},
  {name:'Helm',colour:'helm'},
  {name:'Weapons',colour:'weapons'},
  {name:'Engineering',colour:'engineering'},
  {name:'Science',colour:'science'},
  {name:'Relay',colour:'relay'}
];
const ROLE_NAMES=ROLES.map(r=>r.name);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const claimId=name=>encodeURIComponent(normalize(name));
const capFor=d=>(d?.shipCount===2?12:6);
const roleClass=r=>`role-${String(r).replace(/[^A-Za-z]/g,'')}`;
const dateText=v=>{if(!v)return 'Date not set';const [y,m,d]=String(v).split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));};

let app,auth,db,currentUser=null;
let activeDeployment=null,players=[],unsubs=[];
let playerApp=null,playerAuth=null,playerDb=null,playerUser=null;
let localPlayerProfiles=[],activeLocalProfile=null;
let playerSubscriptionsStarted=false;

function clearUnsubs(){unsubs.forEach(fn=>{try{fn()}catch{}});unsubs=[];}
function msg(el,text,type=''){if(!el)return;el.textContent=text||'';el.className=`message${type?` ${type}`:''}`;}
function shipDefs(d){return d.shipCount===2?[
  {id:'ufn',faction:'UFN',name:d.ufnShipName||DEFAULT_DUAL_UFN},
  {id:'ghosts',faction:'Ghosts',name:d.ghostShipName||DEFAULT_DUAL_GHOST}
]:[{id:'ufn',faction:'UFN',name:d.ufnShipName||DEFAULT_SINGLE_UFN}];}
function roleOptions(selected=''){return `<option value="">Choose…</option><option value="${FLEX}"${selected===FLEX?' selected':''}>${FLEX_LABEL}</option>`+ROLES.map(r=>`<option value="${r.name}"${selected===r.name?' selected':''}>${r.name}</option>`).join('');}
function lockRoleOptions(selected=''){return `<option value="">No station lock</option>`+ROLES.map(r=>`<option value="${r.name}"${selected===r.name?' selected':''}>${r.name}</option>`).join('');}
function preferenceTags(prefs=[]){return prefs.map((p,i)=>p===FLEX?`<span class="pref-tag">${i+1}. ${FLEX_LABEL}</span>`:`<span class="pref-tag ${roleClass(p)}">${i+1}. ${esc(p)}</span>`).join('');}
function rulesBlock(){return `<div class="rules"><div class="rule"><span class="rule-num">1</span><span><b>Rank your stations.</b> Choose three different stations, or choose ${FLEX_LABEL}.</span></div><div class="rule"><span class="rule-num">2</span><span><b>Two-ship games:</b> you may prefer the UFN or Ghost crew, but station preferences matter more.</span></div><div class="rule"><span class="rule-num">3</span><span><b>The crew plan is live.</b> It may move as more players register and the organiser can make final adjustments.</span></div></div>`;}
function setupPreferenceAutofill(ids){
  const sels=ids.map(id=>document.getElementById(id));
  if(sels.some(x=>!x))return;
  function sync(){
    if(sels[0].value===FLEX){
      sels[1].value=FLEX;sels[2].value=FLEX;sels[1].disabled=true;sels[2].disabled=true;return;
    }
    sels[1].disabled=false;
    if(sels[1].value===FLEX){
      sels[2].value=FLEX;sels[2].disabled=true;return;
    }
    sels[2].disabled=false;
  }
  sels.forEach(s=>s.addEventListener('change',sync));sync();
}
function localProfileStorageKey(id){return `ufnCrewProfiles:${id}`;}
function loadLocalProfiles(id){
  try{const raw=JSON.parse(localStorage.getItem(localProfileStorageKey(id))||'[]');return Array.isArray(raw)?raw.filter(x=>x&&x.appName):[];}catch{return [];}
}
function saveLocalProfiles(){
  if(!activeDeployment)return;
  localStorage.setItem(localProfileStorageKey(activeDeployment.id),JSON.stringify(localPlayerProfiles));
}
function newPlayerAppName(id){return `ufn-player-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
async function activatePlayerIdentity(profile=null,{legacy=false}={}){
  const appName=profile?.appName||(legacy?`ufn-player-${activeDeployment?.id||deploymentParam}`:newPlayerAppName(activeDeployment?.id||deploymentParam));
  playerApp=getApps().find(a=>a.name===appName)||initializeApp(firebaseConfig,appName);
  playerAuth=getAuth(playerApp);playerDb=getFirestore(playerApp);
  if(typeof playerAuth.authStateReady==='function')await playerAuth.authStateReady();
  if(!playerAuth.currentUser)await signInAnonymously(playerAuth);
  playerUser=playerAuth.currentUser;
  activeLocalProfile={...(profile||{}),appName,playerId:playerUser.uid,name:profile?.name||''};
  localStorage.setItem(`ufnCrewActive:${activeDeployment?.id||deploymentParam}`,appName);
}
async function selectLocalProfile(appName){
  const profile=localPlayerProfiles.find(x=>x.appName===appName);if(!profile)return;
  await activatePlayerIdentity(profile);renderPlayerPage();
}
async function startAnotherPlayer(){
  if(activeDeployment?.closed)return;
  if(players.length>=capFor(activeDeployment))return;
  await activatePlayerIdentity(null);renderPlayerPage();
}
function rememberActiveProfile(name){
  if(!activeLocalProfile||!playerUser)return;
  const record={appName:activeLocalProfile.appName,playerId:playerUser.uid,name};
  const i=localPlayerProfiles.findIndex(x=>x.appName===record.appName||x.playerId===record.playerId);
  if(i>=0)localPlayerProfiles[i]={...localPlayerProfiles[i],...record};else localPlayerProfiles.push(record);
  activeLocalProfile=record;saveLocalProfiles();
}
function localProfilesMarkup(){
  if(!localPlayerProfiles.length)return '';
  return `<section class="local-profiles"><div class="label">Registered on this device</div><div class="local-profile-list">${localPlayerProfiles.map(p=>{const roster=players.find(x=>x.id===p.playerId);const name=roster?.name||p.name||'Registered player';const current=p.appName===activeLocalProfile?.appName;return `<button type="button" class="local-profile${current?' current':''}" data-local-profile="${esc(p.appName)}"><span>${esc(name)}</span>${current?'<small>Current</small>':'<small>Open</small>'}</button>`;}).join('')}</div></section>`;
}


function quality(p,role){
  if((p.dislikes||[]).includes(role))return{kind:'avoid',label:"Really don't want",cost:100000};
  for(let i=0;i<3;i++){
    const pref=p.prefs?.[i];
    if(pref===FLEX)return{kind:'flex',label:'Happy to fill a gap',cost:5000};
    if(pref===role)return{kind:'rank',rank:i+1,label:`${i+1}${i===0?'st':i===1?'nd':'rd'} choice`,cost:[0,100,500][i]};
  }
  return{kind:'other',label:'Other available station',cost:8000};
}
function overrideFor(d,id){return d?.overrides?.[id]||{};}
function assignmentCost(p,slot,d,index){
  const o=overrideFor(d,p.id);
  if(o.shipId&&o.shipId!==slot.shipId)return Infinity;
  if(o.role&&o.role!==slot.role)return Infinity;
  const q=quality(p,slot.role);
  let cost=q.cost;
  if(p.shipPref&&p.shipPref!==slot.shipId)cost+=20;
  cost+=index*0.00001;
  return cost;
}
function addEdge(g,a,b,cap,cost,meta=null){const f={to:b,rev:g[b].length,cap,cost,meta};const r={to:a,rev:g[a].length,cap:0,cost:-cost};g[a].push(f);g[b].push(r);return f;}
function minCostFlow(g,s,t,want){let flow=0,cost=0;while(flow<want){const n=g.length,dist=Array(n).fill(Infinity),pv=Array(n).fill(-1),pe=Array(n).fill(-1),inq=Array(n).fill(false),q=[s];dist[s]=0;inq[s]=true;while(q.length){const u=q.shift();inq[u]=false;for(let i=0;i<g[u].length;i++){const e=g[u][i];if(e.cap<=0)continue;const nd=dist[u]+e.cost;if(nd<dist[e.to]-1e-9){dist[e.to]=nd;pv[e.to]=u;pe[e.to]=i;if(!inq[e.to]){q.push(e.to);inq[e.to]=true;}}}}if(!Number.isFinite(dist[t]))break;let add=1;for(let v=t;v!==s;v=pv[v]){if(pv[v]<0){add=0;break;}}if(!add)break;for(let v=t;v!==s;v=pv[v]){const e=g[pv[v]][pe[v]];e.cap-=1;g[v][e.rev].cap+=1;}flow++;cost+=dist[t];}return{flow,cost};}
function computePlan(list,d){
  const ships=shipDefs(d),slots=[];
  ships.forEach(ship=>ROLES.forEach(r=>slots.push({shipId:ship.id,ship,role:r.name,colour:r.colour})));
  const eligible=list.slice(0,capFor(d));
  const n=eligible.length,S=0,P=1,T=P+n,K=T+slots.length,g=Array.from({length:K+1},()=>[]),edges=Array.from({length:n},()=>[]);
  eligible.forEach((p,i)=>addEdge(g,S,P+i,1,0));
  slots.forEach((slot,j)=>addEdge(g,T+j,K,1,0));
  eligible.forEach((p,i)=>slots.forEach((slot,j)=>{const c=assignmentCost(p,slot,d,i);if(Number.isFinite(c))edges[i].push({edge:addEdge(g,P+i,T+j,1,c),j});}));
  const solved=minCostFlow(g,S,K,n);if(solved.flow!==n)return{assignments:[],error:'The current organiser locks cannot all be satisfied.'};
  const assignments=[];eligible.forEach((p,i)=>{const used=edges[i].find(x=>x.edge.cap===0);if(!used)return;const slot=slots[used.j];assignments.push({playerId:p.id,name:p.name,shipId:slot.shipId,ship:slot.ship,role:slot.role,colour:slot.colour,quality:quality(p,slot.role),shipMet:!p.shipPref||p.shipPref===slot.shipId,forced:Boolean(overrideFor(d,p.id).shipId||overrideFor(d,p.id).role)});});
  return{assignments,error:''};
}

function renderRoster(plan,d,admin=false){
  const ships=shipDefs(d);
  return `<div class="station-grid${ships.length===1?' one':''}">${ships.map(ship=>{
    const faction=ship.id==='ghosts'?'ghost':'';
    const badge=ship.id==='ghosts'?'assets/ghost-faction.png':'assets/ufn-faction.png';
    const tile=ship.id==='ghosts'?'assets/ghost-faction-tile.png':'assets/ufn-faction-tile.png';
    const strap=ship.id==='ghosts'?'ADAPT • INFILTRATE • DESTROY':'DISCIPLINE • HONOUR • VICTORY';
    const map=new Map(plan.assignments.filter(a=>a.shipId===ship.id).map(a=>[a.role,a]));
    return `<section class="ship-card ${faction}" style="--faction-tile:url('${tile}')"><div class="ship-brand"><img class="faction-badge" src="${badge}" alt="${esc(ship.faction)} insignia"><div class="ship-brand-copy"><div class="eyebrow">${ship.faction} crew</div><div class="ship-title">${esc(ship.name)}</div><div class="faction-strap">${strap}</div></div><span class="pill ${ship.id==='ghosts'?'ghost':'ufn'}">${[...map.values()].length}/6 crew</span></div>${ROLES.map(r=>{const a=map.get(r.name);return `<div class="station ${roleClass(r.name)}"><div class="station-role">${r.name}</div><div class="station-name">${a?esc(a.name):'<span class="sub">To be decided</span>'}</div>${admin&&a?`<div class="station-note">${esc(a.quality.label)}${a.shipMet?'':' · different ship preference'}${a.forced?' · organiser fixed':''}</div>`:''}</div>`}).join('')}</section>`;
  }).join('')}</div>${plan.error?`<div class="message error">${esc(plan.error)}</div>`:''}`;
}

async function boot(){
  app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  if(deploymentParam){await bootPlayer(deploymentParam);return;}
  onAuthStateChanged(auth,user=>{currentUser=user;if(!user){renderLogin();return;}if(user.uid!==ADMIN_UID){renderWrongAccount();return;}renderTop();renderDashboard();});
}
function renderTop(){topActions.innerHTML=`<span class="pill ufn">UFN organiser</span><button id="logout" class="btn ghost tiny">Sign out</button>`;$('#logout').onclick=()=>signOut(auth);}
function renderLogin(){
  topActions.innerHTML='';
  main.innerHTML=`
    <section class="admin-entry-shell">
      <div class="admin-entry-card">
        <div class="eyebrow idp-eyebrow">UFN DEPLOYMENT ADMINISTRATION</div>
        <h1>Administrator access</h1>
        <p>This console is restricted to the authorised UFN deployment organiser.</p>
        <button id="googleLogin" class="btn admin-google">Continue with Google</button>
        <div id="loginMessage" class="message"></div>
      </div>
    </section>`;
  $('#googleLogin').onclick=async()=>{
    try{await signInWithPopup(auth,new GoogleAuthProvider())}
    catch(e){msg($('#loginMessage'),e.message,'error')}
  };
}
function renderWrongAccount(){topActions.innerHTML='';main.innerHTML=`<section class="empty-state"><h2>Account not authorised</h2><p>This UFN integration is restricted to the designated organiser account.</p><div class="actions" style="justify-content:center"><button id="wrongLogout" class="btn ghost">Sign out</button></div></section>`;$('#wrongLogout').onclick=()=>signOut(auth);}

async function renderDashboard(){clearUnsubs();main.innerHTML=`<div class="page-head"><div><div class="eyebrow">UFN organiser dashboard</div><h1>Deployments</h1><p class="sub">Create a deployment, share its player link, then manage the live crew suggestion.</p></div><button id="createDeployment" class="btn primary">Create deployment</button></div><div id="deployments" class="grid cards"><section class="loading-card"><div class="scanner"></div><p>Loading deployments…</p></section></div>`;$('#createDeployment').onclick=()=>openDeploymentModal();const q=query(collection(db,'ufnDeployments'),orderBy('date','desc'));unsubs.push(onSnapshot(q,snap=>{const ds=snap.docs.map(x=>({id:x.id,...x.data()}));$('#deployments').innerHTML=ds.length?ds.map(renderDeploymentCard).join(''):`<section class="empty-state"><h2>No deployments yet</h2><p>Create the first UFN crew deployment.</p></section>`;ds.forEach(d=>{document.querySelector(`[data-manage="${d.id}"]`)?.addEventListener('click',()=>manageDeployment(d.id));document.querySelector(`[data-copy="${d.id}"]`)?.addEventListener('click',()=>navigator.clipboard.writeText(playerUrl(d.id)));});}));}
function playerUrl(id){return `${location.origin}${location.pathname}?m=${encodeURIComponent(id)}`;}
function renderDeploymentCard(d){return `<section class="panel mission-card"><div class="mission-date">${esc(dateText(d.date))}</div><h2>${esc(d.title||'UFN Deployment')}</h2><p class="sub">${d.shipCount===2?`${esc(d.ufnShipName)} + ${esc(d.ghostShipName)}`:esc(d.ufnShipName)}</p><div class="mission-meta"><span class="pill ${d.closed?'closed':'open'}">${d.closed?'Choices closed':'Choices open'}</span><span class="pill">${Number(d.responseCount||0)}/${capFor(d)} responses</span></div><div class="share-box"><input readonly value="${esc(playerUrl(d.id))}"><button class="btn ghost tiny" data-copy="${d.id}">Copy link</button></div><div class="actions"><button class="btn primary" data-manage="${d.id}">Manage crew</button></div></section>`;}
function openDeploymentModal(existing=null){
  const initialCount=existing?.shipCount||1;
  const initialUfn=existing?.ufnShipName||(initialCount===2?DEFAULT_DUAL_UFN:DEFAULT_SINGLE_UFN);
  const initialGhost=existing?.ghostShipName||DEFAULT_DUAL_GHOST;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<section class="modal panel"><button class="btn ghost tiny modal-close">Close</button><div class="eyebrow">Deployment setup</div><h2>${existing?'Edit':'Create'} UFN deployment</h2><form id="deploymentForm"><div class="field"><label>Deployment name</label><input id="depTitle" required maxlength="80" value="${esc(existing?.title||'')}"></div><div class="field"><label>Date</label><input id="depDate" type="date" required value="${esc(existing?.date||'')}"></div><div class="label">Ships in use</div><div class="ship-choice"><button type="button" class="btn ghost ${initialCount!==2?'selected':''}" data-count="1"><b>1 ship</b><span>UFN only · 6 crew</span></button><button type="button" class="btn ghost ${initialCount===2?'selected':''}" data-count="2"><b>2 ships</b><span>UFN + Ghosts · 12 crew</span></button></div><input id="shipCount" type="hidden" value="${initialCount}"><div class="field" style="margin-top:12px"><label>UFN ship name</label><input id="ufnShip" maxlength="60" required value="${esc(initialUfn)}"></div><div id="ghostField" class="field ${initialCount===2?'':'hidden'}"><label>Ghost ship name</label><input id="ghostShip" maxlength="60" value="${esc(initialGhost)}"></div><div class="actions"><button class="btn primary" type="submit">${existing?'Save setup':'Create deployment'}</button></div><div id="depMessage" class="message"></div></form></section>`;
  document.body.appendChild(wrap);wrap.querySelector('.modal-close').onclick=()=>wrap.remove();
  wrap.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{
    const oldCount=Number($('#shipCount').value);const newCount=Number(b.dataset.count);
    wrap.querySelectorAll('[data-count]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
    $('#shipCount').value=String(newCount);$('#ghostField').classList.toggle('hidden',newCount!==2);
    const current=$('#ufnShip').value.trim();
    if(!existing||!current||current===DEFAULT_SINGLE_UFN||current===DEFAULT_DUAL_UFN){$('#ufnShip').value=newCount===2?DEFAULT_DUAL_UFN:DEFAULT_SINGLE_UFN;}
    if(newCount===2&&!$('#ghostShip').value.trim())$('#ghostShip').value=DEFAULT_DUAL_GHOST;
  });
  $('#deploymentForm').onsubmit=async e=>{e.preventDefault();const shipCount=Number($('#shipCount').value);const data={title:$('#depTitle').value.trim(),date:$('#depDate').value,shipCount,ufnShipName:$('#ufnShip').value.trim()||(shipCount===2?DEFAULT_DUAL_UFN:DEFAULT_SINGLE_UFN),ghostShipName:shipCount===2?($('#ghostShip').value.trim()||DEFAULT_DUAL_GHOST):'',closed:existing?.closed||false,overrides:existing?.overrides||{},responseCount:Number(existing?.responseCount||0),updatedAt:serverTimestamp(),createdAt:existing?.createdAt||serverTimestamp()};try{if(existing)await setDoc(doc(db,'ufnDeployments',existing.id),data,{merge:true});else await addDoc(collection(db,'ufnDeployments'),data);wrap.remove()}catch(err){msg($('#depMessage'),err.message,'error')}};
}

async function manageDeployment(id){clearUnsubs();const ref=doc(db,'ufnDeployments',id),snap=await getDoc(ref);if(!snap.exists()){renderDashboard();return;}activeDeployment={id,...snap.data()};players=[];main.innerHTML=`<div class="deployment-visual-banner"><div class="deployment-visual-copy"><span>Interstellar Deployment Planner</span><b>UFN Deployment Services</b></div><div class="deployment-factions"><img src="assets/ufn-faction.png" alt="UFN">${activeDeployment.shipCount===2?'<span>+</span><img src="assets/ghost-faction.png" alt="Ghosts">':''}</div></div><div class="page-head"><div><button id="backDash" class="btn ghost tiny">← Dashboard</button><div class="eyebrow" style="margin-top:10px">Crew management</div><h1>${esc(activeDeployment.title)}</h1><p class="sub">${esc(dateText(activeDeployment.date))}</p></div><div class="actions"><button id="setupBtn" class="btn ghost">Deployment setup</button><button id="toggleClosed" class="btn ${activeDeployment.closed?'success':'danger'}">${activeDeployment.closed?'Open choices':'Close choices'}</button></div></div><div class="grid two"><aside><section class="panel"><h2>Player link</h2><p class="sub">Share this link with everyone who should add preferences.</p><div class="share-box"><input id="manageLink" readonly value="${esc(playerUrl(id))}"><button id="copyManageLink" class="btn primary tiny">Copy link</button></div><div id="responseStats" class="mission-meta"></div></section><section class="panel" style="margin-top:14px"><h2>Responses</h2><div class="field"><label>Registered player</label><select id="playerSelect" class="select-player"><option value="">Select a player…</option></select></div><div id="responseEditor" class="response-editor"><div class="sub">Select a registered player to view or edit their preferences and organiser locks.</div></div></section></aside><section class="panel"><div class="eyebrow">Live suggestion</div><h2>Current crew plan</h2><p class="sub">Station preferences are prioritised globally. Organiser ship/station locks are hard constraints.</p><div id="roster"></div></section></div>`;
  $('#backDash').onclick=()=>renderDashboard();$('#copyManageLink').onclick=()=>navigator.clipboard.writeText(playerUrl(id));$('#setupBtn').onclick=()=>openDeploymentModal(activeDeployment);$('#toggleClosed').onclick=async()=>updateDoc(ref,{closed:!activeDeployment.closed,updatedAt:serverTimestamp()});$('#playerSelect').onchange=()=>renderResponseEditor($('#playerSelect').value);
  unsubs.push(onSnapshot(ref,s=>{if(!s.exists())return renderDashboard();activeDeployment={id,...s.data()};$('#toggleClosed').textContent=activeDeployment.closed?'Open choices':'Close choices';$('#toggleClosed').className=`btn ${activeDeployment.closed?'success':'danger'}`;refreshManage();}));
  unsubs.push(onSnapshot(collection(db,'ufnDeployments',id,'players'),snap=>{players=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));refreshManage();}));
}
function refreshManage(){if(!activeDeployment||!$('#roster'))return;const plan=computePlan(players,activeDeployment);$('#roster').innerHTML=renderRoster(plan,activeDeployment,true);$('#responseStats').innerHTML=`<span class="pill">${players.length}/${capFor(activeDeployment)} responses</span><span class="pill">${plan.assignments.filter(a=>a.quality.rank===1).length} first choices</span>`;const sel=$('#playerSelect');const keep=sel.value;sel.innerHTML='<option value="">Select a player…</option>'+players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');if(players.some(p=>p.id===keep)){sel.value=keep;renderResponseEditor(keep);}else renderResponseEditor('');}
function renderResponseEditor(id){const box=$('#responseEditor');if(!box)return;const p=players.find(x=>x.id===id);if(!p){box.innerHTML='<div class="sub">Select a registered player to view or edit their preferences and organiser locks.</div>';return;}const plan=computePlan(players,activeDeployment),a=plan.assignments.find(x=>x.playerId===p.id),o=overrideFor(activeDeployment,p.id),ships=shipDefs(activeDeployment);box.innerHTML=`<h3>${esc(p.name)}</h3><div class="assignment">${a?`${esc(a.ship.name)} • ${esc(a.role)}`:'Awaiting assignment'}</div><div class="response-editor-grid"><div><div class="label">Station preferences</div><div class="prefs-preview">${preferenceTags(p.prefs||[])}</div>${activeDeployment.shipCount===2?`<dl><dt>Preferred ship</dt><dd>${p.shipPref?(p.shipPref==='ufn'?esc(activeDeployment.ufnShipName):esc(activeDeployment.ghostShipName)):'No preference'}</dd></dl>`:''}<dl><dt>Really don't want</dt><dd>${(p.dislikes||[]).length?(p.dislikes||[]).map(esc).join(', '):'None'}</dd></dl></div><div><dl><dt>Current result</dt><dd>${a?esc(a.quality.label):'Awaiting assignment'}</dd><dt>Organiser ship lock</dt><dd>${o.shipId?(o.shipId==='ufn'?esc(activeDeployment.ufnShipName):esc(activeDeployment.ghostShipName)):'None'}</dd><dt>Organiser station lock</dt><dd>${o.role||'None'}</dd></dl><div class="actions"><button id="editPlayer" class="btn primary">Edit player</button><button id="deletePlayer" class="btn danger">Delete</button></div></div></div>`;$('#editPlayer').onclick=()=>openPlayerAdminModal(p);$('#deletePlayer').onclick=()=>deletePlayerAdmin(p);}
function openPlayerAdminModal(p){const o=overrideFor(activeDeployment,p.id),wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<section class="modal panel"><button class="btn ghost tiny modal-close">Close</button><div class="eyebrow">Player preferences</div><h2>${esc(p.name)}</h2><form id="adminPlayerForm"><div class="field"><label>Player name</label><input id="apName" value="${esc(p.name)}" required maxlength="60"></div>${activeDeployment.shipCount===2?`<div class="field"><label>Player ship preference</label><select id="apShipPref"><option value="">No preference</option><option value="ufn"${p.shipPref==='ufn'?' selected':''}>${esc(activeDeployment.ufnShipName)}</option><option value="ghosts"${p.shipPref==='ghosts'?' selected':''}>${esc(activeDeployment.ghostShipName)}</option></select></div>`:''}<div class="field"><label>1st station</label><select id="ap1">${roleOptions(p.prefs?.[0])}</select></div><div class="field"><label>2nd station</label><select id="ap2">${roleOptions(p.prefs?.[1])}</select></div><div class="field"><label>3rd station</label><select id="ap3">${roleOptions(p.prefs?.[2])}</select></div><div class="label">Really don't want</div><div id="apDislikes" class="checks">${ROLES.map(r=>`<label class="check"><input type="checkbox" value="${r.name}"${(p.dislikes||[]).includes(r.name)?' checked':''}><span>${r.name}</span></label>`).join('')}</div><h3 style="margin-top:14px">Organiser locks</h3><div class="field"><label>Lock to ship</label><select id="lockShip"><option value="">No ship lock</option>${shipDefs(activeDeployment).map(s=>`<option value="${s.id}"${o.shipId===s.id?' selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Lock to station</label><select id="lockRole">${lockRoleOptions(o.role||'')}</select></div><div class="actions"><button class="btn primary">Save changes</button></div><div id="apMessage" class="message"></div></form></section>`;document.body.appendChild(wrap);wrap.querySelector('.modal-close').onclick=()=>wrap.remove();setupPreferenceAutofill(['ap1','ap2','ap3']);$('#adminPlayerForm').onsubmit=async e=>{e.preventDefault();const payload={name:$('#apName').value.trim(),shipPref:$('#apShipPref')?.value||'',prefs:[$('#ap1').value,$('#ap2').value,$('#ap3').value],dislikes:[...$('#apDislikes').querySelectorAll('input:checked')].map(x=>x.value),source:p.source||'player',updatedAt:serverTimestamp()};const err=validatePrefs(payload);if(err)return msg($('#apMessage'),err,'error');try{await updateDoc(doc(db,'ufnDeployments',activeDeployment.id,'players',p.id),payload);const overrides={...(activeDeployment.overrides||{})};const shipId=$('#lockShip').value,role=$('#lockRole').value;if(shipId||role)overrides[p.id]={shipId,role};else delete overrides[p.id];await updateDoc(doc(db,'ufnDeployments',activeDeployment.id),{overrides,updatedAt:serverTimestamp()});wrap.remove()}catch(err){msg($('#apMessage'),err.message,'error')}};}
async function deletePlayerAdmin(p){if(!confirm(`Delete ${p.name} from this deployment?`))return;const depRef=doc(db,'ufnDeployments',activeDeployment.id),pRef=doc(db,'ufnDeployments',activeDeployment.id,'players',p.id),claimRef=doc(db,'ufnDeployments',activeDeployment.id,'nameClaims',claimId(p.name));await runTransaction(db,async tx=>{const dep=await tx.get(depRef);tx.delete(pRef);tx.delete(claimRef);if(dep.exists())tx.update(depRef,{responseCount:Math.max(0,Number(dep.data().responseCount||0)-1),updatedAt:serverTimestamp()});});}

function validatePrefs(p){if(!p.name)return 'Enter a name.';if(!p.prefs?.[0]||!p.prefs?.[1]||!p.prefs?.[2])return `Choose all three station preferences, or use ${FLEX_LABEL}.`;const firstFlex=p.prefs.indexOf(FLEX);if(firstFlex>=0&&p.prefs.slice(firstFlex).some(x=>x!==FLEX))return `After ${FLEX_LABEL}, remaining choices should also be ${FLEX_LABEL}.`;const concrete=p.prefs.filter(x=>x!==FLEX);if(new Set(concrete).size!==concrete.length)return 'Choose different stations for ranked choices.';const clash=concrete.find(x=>(p.dislikes||[]).includes(x));if(clash)return `${clash} cannot be both preferred and really unwanted.`;return '';}

async function bootPlayer(id){
  topActions.innerHTML='';main.innerHTML='<section class="loading-card"><div class="scanner"></div><h1>Opening deployment…</h1><p>Connecting to UFN crew services.</p></section>';
  localPlayerProfiles=loadLocalProfiles(id);
  const activeName=localStorage.getItem(`ufnCrewActive:${id}`);
  const preferred=localPlayerProfiles.find(x=>x.appName===activeName)||localPlayerProfiles[0]||null;
  // Legacy fixed app name preserves any player registered before multi-profile support.
  await activatePlayerIdentity(preferred,{legacy:!preferred});
  const depRef=doc(playerDb,'ufnDeployments',id),snap=await getDoc(depRef);
  if(!snap.exists()){main.innerHTML='<section class="empty-state"><h2>Deployment not found</h2><p>Check the player link with your organiser.</p></section>';return;}
  activeDeployment={id,...snap.data()};
  const listenerDb=playerDb;
  unsubs.push(onSnapshot(doc(listenerDb,'ufnDeployments',id),s=>{if(s.exists()){activeDeployment={id,...s.data()};renderPlayerPage();}}));
  unsubs.push(onSnapshot(collection(listenerDb,'ufnDeployments',id,'players'),s=>{
    players=s.docs.map(x=>({id:x.id,...x.data()}));
    const mine=players.find(p=>p.id===playerUser?.uid);
    if(mine&&!localPlayerProfiles.some(x=>x.playerId===mine.id)){rememberActiveProfile(mine.name);}
    renderPlayerPage();
  }));
}
function renderPlayerPage(){
  if(!activeDeployment||!playerUser)return;
  const existing=players.find(p=>p.id===playerUser.uid),full=players.length>=capFor(activeDeployment)&&!existing,plan=computePlan(players,activeDeployment);
  const profiles=localProfilesMarkup();
  const canAdd=!activeDeployment.closed&&players.length<capFor(activeDeployment);
  main.innerHTML=`<div class="deployment-visual-banner player"><div class="deployment-visual-copy"><span>Interstellar Deployment Planner</span><b>UFN Crew Assignment Service</b></div><div class="deployment-factions"><img src="assets/ufn-faction.png" alt="UFN">${activeDeployment.shipCount===2?'<span>+</span><img src="assets/ghost-faction.png" alt="Ghosts">':''}</div></div><div class="page-head"><div><div class="eyebrow">UFN crew registration</div><h1>${esc(activeDeployment.title)}</h1><p class="sub">${esc(dateText(activeDeployment.date))} · ${activeDeployment.shipCount===2?`${esc(activeDeployment.ufnShipName)} + ${esc(activeDeployment.ghostShipName)}`:esc(activeDeployment.ufnShipName)}</p></div><span class="pill ${activeDeployment.closed?'closed':'open'}">${activeDeployment.closed?'Choices closed':'Choices open'}</span></div><div class="grid two player-layout"><aside><section class="panel"><h2>Your crew choices</h2>${profiles}${localPlayerProfiles.length?`<div class="actions profile-actions"><button id="registerAnother" type="button" class="btn ghost" ${canAdd?'':'disabled'}>Register someone else</button></div>`:''}${rulesBlock()}${full?`<div class="message warn"><b>This deployment is full.</b><br>All ${capFor(activeDeployment)} crew places have been registered. You can still reopen anyone already registered on this device.</div>`:`<form id="playerForm"><div class="field"><label>Name / callsign</label><input id="pName" required maxlength="60" ${existing?'readonly':''} value="${esc(existing?.name||'')}"></div>${activeDeployment.shipCount===2?`<div class="field"><label>Preferred crew</label><select id="pShip"><option value="">No preference</option><option value="ufn"${existing?.shipPref==='ufn'?' selected':''}>${esc(activeDeployment.ufnShipName)} (UFN)</option><option value="ghosts"${existing?.shipPref==='ghosts'?' selected':''}>${esc(activeDeployment.ghostShipName)} (Ghosts)</option></select></div>`:''}<div class="field"><label>1st station</label><select id="p1">${roleOptions(existing?.prefs?.[0])}</select></div><div class="field"><label>2nd station</label><select id="p2">${roleOptions(existing?.prefs?.[1])}</select></div><div class="field"><label>3rd station</label><select id="p3">${roleOptions(existing?.prefs?.[2])}</select></div><div class="label">Really don't want</div><div id="pDislikes" class="checks">${ROLES.map(r=>`<label class="check"><input type="checkbox" value="${r.name}"${(existing?.dislikes||[]).includes(r.name)?' checked':''}><span>${r.name}</span></label>`).join('')}</div><div class="actions"><button class="btn primary" ${activeDeployment.closed?'disabled':''}>${existing?'Update my choices':'Register choices'}</button></div><div id="playerMessage" class="message"></div><div class="capacity-note">${players.length}/${capFor(activeDeployment)} registered.</div></form>`}</section></aside><section class="panel roster-panel"><div class="eyebrow">Live suggestion</div><h2>Crew plan so far</h2><p class="sub">This is provisional and can change as more crew register.</p>${renderRoster(plan,activeDeployment,false)}</section></div>`;
  document.querySelectorAll('[data-local-profile]').forEach(b=>b.onclick=()=>selectLocalProfile(b.dataset.localProfile));
  if($('#registerAnother'))$('#registerAnother').onclick=startAnotherPlayer;
  if(!full&&$('#playerForm')){setupPreferenceAutofill(['p1','p2','p3']);$('#playerForm').onsubmit=savePlayerChoices;}
}
async function savePlayerChoices(e){
  e.preventDefault();if(activeDeployment.closed)return msg($('#playerMessage'),'Choices are closed. Contact the organiser.','warn');
  const payload={name:$('#pName').value.trim(),shipPref:$('#pShip')?.value||'',prefs:[$('#p1').value,$('#p2').value,$('#p3').value],dislikes:[...$('#pDislikes').querySelectorAll('input:checked')].map(x=>x.value),source:'player'};
  const err=validatePrefs(payload);if(err)return msg($('#playerMessage'),err,'error');
  const depRef=doc(playerDb,'ufnDeployments',activeDeployment.id),pRef=doc(playerDb,'ufnDeployments',activeDeployment.id,'players',playerUser.uid),claimRef=doc(playerDb,'ufnDeployments',activeDeployment.id,'nameClaims',claimId(payload.name));
  try{
    await runTransaction(playerDb,async tx=>{
      const [dep,old,claim]=await Promise.all([tx.get(depRef),tx.get(pRef),tx.get(claimRef)]);
      if(!dep.exists())throw new Error('Deployment no longer exists.');const d=dep.data();if(d.closed)throw new Error('Choices are closed.');
      if(claim.exists()&&claim.data().playerId!==playerUser.uid)throw new Error('That name is already registered for this deployment.');
      const isNew=!old.exists();if(isNew&&Number(d.responseCount||0)>=capFor(d))throw new Error(`This deployment is full (${capFor(d)} crew).`);
      const data={...payload,createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      tx.set(pRef,data,{merge:true});tx.set(claimRef,{playerId:playerUser.uid,name:payload.name,updatedAt:serverTimestamp()},{merge:true});
      if(isNew)tx.update(depRef,{responseCount:Number(d.responseCount||0)+1,updatedAt:serverTimestamp()});
    });
    rememberActiveProfile(payload.name);msg($('#playerMessage'),'Your choices are saved.','ok');renderPlayerPage();
  }catch(err){msg($('#playerMessage'),err.message,'error')}
}

boot().catch(err=>{console.error(err);main.innerHTML=`<section class="empty-state"><h2>Could not open crew services</h2><p>${esc(err.message)}</p></section>`;});
