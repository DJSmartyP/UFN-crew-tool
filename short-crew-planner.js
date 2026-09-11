import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const ROLES=[
  {name:'Captain',colour:'command'},
  {name:'Helm',colour:'helm'},
  {name:'Weapons',colour:'weapons'},
  {name:'Engineering',colour:'engineering'},
  {name:'Science',colour:'science'},
  {name:'Relay',colour:'relay'}
];
const ROLE_BY_NAME=new Map(ROLES.map(r=>[r.name,r]));
const FLEX='__FLEX__';
const params=new URLSearchParams(location.search);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const roleClass=r=>`role-${String(r).replace(/[^A-Za-z]/g,'')}`;
const dateText=v=>{
  if(!v)return 'Date not set';
  const [y,m,d]=String(v).split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB',{
    day:'numeric',month:'long',year:'numeric',timeZone:'UTC'
  }).format(new Date(Date.UTC(y,m-1,d)));
};
const capFor=d=>d?.shipCount===2?12:6;

function shipDefs(d){
  if(d?.shipCount===2){
    return [
      {id:'ufn',faction:'UFN',name:d.ufnShipName||'UFN Celeste'},
      {id:'ghosts',faction:'Ghosts',name:d.ghostShipName||'GST Darkwater'}
    ];
  }
  return [{id:'ufn',faction:'UFN',name:d?.ufnShipName||'UFN Vanguard'}];
}

function quality(p,role){
  if((p.dislikes||[]).includes(role)){
    return {kind:'avoid',label:"Really don't want",cost:100000};
  }
  for(let i=0;i<3;i++){
    const pref=p.prefs?.[i];
    if(pref===FLEX)return {kind:'flex',label:'Happy to fill a gap',cost:5000};
    if(pref===role){
      return {
        kind:'rank',
        rank:i+1,
        label:`${i+1}${i===0?'st':i===1?'nd':'rd'} choice`,
        cost:[0,100,500][i]
      };
    }
  }
  return {kind:'other',label:'Other available station',cost:8000};
}

function overrideFor(d,id){
  return d?.overrides?.[id]||{};
}

function addEdge(g,a,b,cap,cost){
  const f={to:b,rev:g[b].length,cap,cost};
  const r={to:a,rev:g[a].length,cap:0,cost:-cost};
  g[a].push(f);g[b].push(r);
  return f;
}

function minCostFlow(g,s,t,want){
  let flow=0,cost=0;
  while(flow<want){
    const n=g.length;
    const dist=Array(n).fill(Infinity),pv=Array(n).fill(-1),pe=Array(n).fill(-1),inq=Array(n).fill(false);
    const q=[s];
    dist[s]=0;inq[s]=true;

    while(q.length){
      const u=q.shift();
      inq[u]=false;
      for(let i=0;i<g[u].length;i++){
        const e=g[u][i];
        if(e.cap<=0)continue;
        const nd=dist[u]+e.cost;
        if(nd<dist[e.to]-1e-9){
          dist[e.to]=nd;pv[e.to]=u;pe[e.to]=i;
          if(!inq[e.to]){q.push(e.to);inq[e.to]=true;}
        }
      }
    }

    if(!Number.isFinite(dist[t]))break;
    let add=1;
    for(let v=t;v!==s;v=pv[v]){
      if(pv[v]<0){add=0;break;}
    }
    if(!add)break;

    for(let v=t;v!==s;v=pv[v]){
      const e=g[pv[v]][pe[v]];
      e.cap-=1;
      g[v][e.rev].cap+=1;
    }
    flow++;
    cost+=dist[t];
  }
  return {flow,cost};
}

function standardAssignmentCost(p,slot,d,index){
  const o=overrideFor(d,p.id);
  if(o.shipId&&o.shipId!==slot.shipId)return Infinity;
  if(o.role&&o.role!==slot.role)return Infinity;

  let cost=quality(p,slot.role).cost;
  if(p.shipPref&&p.shipPref!==slot.shipId)cost+=20;
  cost+=index*0.00001;
  return cost;
}

function solveStandard(list,d){
  const ships=shipDefs(d),slots=[];
  ships.forEach(ship=>ROLES.forEach(r=>slots.push({
    shipId:ship.id,ship,role:r.name,colour:r.colour
  })));

  const eligible=list.slice(0,capFor(d));
  const n=eligible.length,S=0,P=1,T=P+n,K=T+slots.length;
  const g=Array.from({length:K+1},()=>[]);
  const edges=Array.from({length:n},()=>[]);

  eligible.forEach((p,i)=>addEdge(g,S,P+i,1,0));
  slots.forEach((slot,j)=>addEdge(g,T+j,K,1,0));
  eligible.forEach((p,i)=>slots.forEach((slot,j)=>{
    const c=standardAssignmentCost(p,slot,d,i);
    if(Number.isFinite(c)){
      edges[i].push({edge:addEdge(g,P+i,T+j,1,c),j});
    }
  }));

  const solved=minCostFlow(g,S,K,n);
  if(solved.flow!==n){
    return {assignments:[],error:'The current organiser locks cannot all be satisfied.'};
  }

  const assignments=[];
  eligible.forEach((p,i)=>{
    const used=edges[i].find(x=>x.edge.cap===0);
    if(!used)return;
    const slot=slots[used.j];
    assignments.push({
      playerId:p.id,
      name:p.name,
      shipId:slot.shipId,
      ship:slot.ship,
      role:slot.role,
      colour:slot.colour,
      quality:quality(p,slot.role),
      shipMet:!p.shipPref||p.shipPref===slot.shipId,
      forced:Boolean(overrideFor(d,p.id).shipId||overrideFor(d,p.id).role),
      bundleRoles:[slot.role],
      combinedLabel:''
    });
  });

  return {assignments,error:'',cost:solved.cost};
}

function shortCrewPatterns(ship,count){
  if(count===5){
    return ROLES.filter(r=>r.name!=='Captain').map(extra=>{
      const bundles=[
        {shipId:ship.id,ship,roles:['Captain',extra.name],kind:'captain-plus'}
      ];
      ROLES
        .filter(r=>r.name!=='Captain'&&r.name!==extra.name)
        .forEach(r=>bundles.push({shipId:ship.id,ship,roles:[r.name],kind:'single'}));
      return bundles;
    });
  }

  if(count===4){
    return ['Engineering','Science','Relay'].map(extra=>{
      const bundles=[
        {shipId:ship.id,ship,roles:['Captain',extra],kind:'captain-plus'},
        {shipId:ship.id,ship,roles:['Helm','Weapons'],kind:'helm-weapons'}
      ];
      ['Engineering','Science','Relay']
        .filter(r=>r!==extra)
        .forEach(role=>bundles.push({shipId:ship.id,ship,roles:[role],kind:'single'}));
      return bundles;
    });
  }

  return [];
}

function bundleCost(p,bundle,d,index){
  const o=overrideFor(d,p.id);
  if(o.shipId&&o.shipId!==bundle.shipId)return Infinity;
  if(o.role&&!bundle.roles.includes(o.role))return Infinity;

  let cost=0;
  for(const role of bundle.roles)cost+=quality(p,role).cost;
  if(p.shipPref&&p.shipPref!==bundle.shipId)cost+=20;
  cost+=index*0.00001;
  return cost;
}

function combinedLabelFor(role,bundleRoles){
  if(bundleRoles.length<2)return '';
  const others=bundleRoles.filter(r=>r!==role);
  if(role==='Captain')return `Also: ${others.join(' + ')}`;
  if(bundleRoles.includes('Captain'))return 'Combined with Captain';
  return `Combined with ${others.join(' + ')}`;
}

function solveBundles(players,ship,d,bundles){
  const n=players.length;
  if(bundles.length!==n)return null;

  const S=0,P=1,T=P+n,K=T+bundles.length;
  const g=Array.from({length:K+1},()=>[]);
  const edges=Array.from({length:n},()=>[]);

  players.forEach((p,i)=>addEdge(g,S,P+i,1,0));
  bundles.forEach((bundle,j)=>addEdge(g,T+j,K,1,0));

  players.forEach((p,i)=>bundles.forEach((bundle,j)=>{
    const c=bundleCost(p,bundle,d,i);
    if(Number.isFinite(c)){
      edges[i].push({edge:addEdge(g,P+i,T+j,1,c),j});
    }
  }));

  const solved=minCostFlow(g,S,K,n);
  if(solved.flow!==n)return null;

  const assignments=[];
  players.forEach((p,i)=>{
    const used=edges[i].find(x=>x.edge.cap===0);
    if(!used)return;
    const bundle=bundles[used.j];
    bundle.roles.forEach(role=>{
      assignments.push({
        playerId:p.id,
        name:p.name,
        shipId:ship.id,
        ship,
        role,
        colour:ROLE_BY_NAME.get(role)?.colour||'',
        quality:quality(p,role),
        shipMet:!p.shipPref||p.shipPref===ship.id,
        forced:Boolean(overrideFor(d,p.id).shipId||overrideFor(d,p.id).role),
        bundleRoles:[...bundle.roles],
        combinedLabel:combinedLabelFor(role,bundle.roles)
      });
    });
  });

  return {assignments,cost:solved.cost};
}

function computeShortCrewPlan(list,d){
  const base=solveStandard(list,d);
  if(base.error)return {...base,hasShortCrew:false,shortCrewShips:[]};

  const eligible=list.slice(0,capFor(d));
  const ships=shipDefs(d);
  const result=[];
  const shortCrewShips=[];

  for(const ship of ships){
    const ids=new Set(
      base.assignments
        .filter(a=>a.shipId===ship.id)
        .map(a=>a.playerId)
    );
    const group=eligible.filter(p=>ids.has(p.id));

    if(group.length!==4&&group.length!==5){
      result.push(...base.assignments.filter(a=>a.shipId===ship.id));
      continue;
    }

    let best=null;
    for(const bundles of shortCrewPatterns(ship,group.length)){
      const solved=solveBundles(group,ship,d,bundles);
      if(solved&&(!best||solved.cost<best.cost))best=solved;
    }

    if(!best){
      return {
        assignments:[],
        error:`The ${ship.name} short-crew rules conflict with the current organiser locks.`,
        hasShortCrew:true,
        shortCrewShips:[ship.id]
      };
    }

    result.push(...best.assignments);
    shortCrewShips.push(ship.id);
  }

  return {
    assignments:result,
    error:'',
    hasShortCrew:shortCrewShips.length>0,
    shortCrewShips
  };
}

function crewCount(plan,shipId){
  return new Set(
    plan.assignments.filter(a=>a.shipId===shipId).map(a=>a.playerId)
  ).size;
}

function shortCrewSummary(plan,ship){
  const count=crewCount(plan,ship.id);
  if(count===5){
    const captain=plan.assignments.find(a=>a.shipId===ship.id&&a.role==='Captain');
    const extra=captain?.bundleRoles?.find(r=>r!=='Captain');
    return extra?`5-player crew: Captain also covers ${extra}.`:'5-player crew rule active.';
  }
  if(count===4){
    const captain=plan.assignments.find(a=>a.shipId===ship.id&&a.role==='Captain');
    const extra=captain?.bundleRoles?.find(r=>r!=='Captain');
    return `4-player crew: Helm + Weapons are combined${extra?` and Captain also covers ${extra}`:''}.`;
  }
  return '';
}

function renderRoster(plan,d,admin=false){
  const ships=shipDefs(d);
  if(plan.error){
    return `<div class="station-grid one short-crew-rendered"><div class="message error">${esc(plan.error)}</div></div>`;
  }

  return `<div class="station-grid${ships.length===1?' one':''} short-crew-rendered">${ships.map(ship=>{
    const faction=ship.id==='ghosts'?'ghost':'';
    const badge=ship.id==='ghosts'?'assets/ghost-faction.png':'assets/ufn-faction.png';
    const strap=ship.id==='ghosts'?'ADAPT • INFILTRATE • DESTROY':'DISCIPLINE • HONOUR • VICTORY';
    const map=new Map(plan.assignments.filter(a=>a.shipId===ship.id).map(a=>[a.role,a]));
    const count=crewCount(plan,ship.id);
    const summary=shortCrewSummary(plan,ship);

    return `<section class="ship-card ${faction}">
      <div class="ship-brand">
        <img class="faction-badge" src="${badge}" alt="${esc(ship.faction)} insignia">
        <div class="ship-brand-copy">
          <div class="eyebrow">${esc(ship.faction)} crew</div>
          <div class="ship-title">${esc(ship.name)}</div>
          <div class="faction-strap">${strap}</div>
        </div>
        <span class="pill ${ship.id==='ghosts'?'ghost':'ufn'}">${count}/6 crew</span>
      </div>
      ${summary?`<div class="short-crew-summary">${esc(summary)}</div>`:''}
      ${ROLES.map(r=>{
        const a=map.get(r.name);
        const notes=[];
        if(a?.combinedLabel)notes.push(a.combinedLabel);
        if(admin&&a){
          notes.push(a.quality.label);
          if(!a.shipMet)notes.push('different ship preference');
          if(a.forced)notes.push('organiser fixed');
        }
        return `<div class="station ${roleClass(r.name)}${a?.combinedLabel?' short-crew-combined':''}">
          <div class="station-role">${r.name}</div>
          <div class="station-name">${a?esc(a.name):'<span class="sub">To be decided</span>'}</div>
          ${notes.length?`<div class="station-note short-crew-note">${notes.map(esc).join(' · ')}</div>`:''}
        </div>`;
      }).join('')}
    </section>`;
  }).join('')}</div>`;
}

function currentDeploymentId(){
  const direct=params.get('m');
  if(direct)return direct;

  const input=document.querySelector('#manageLink');
  if(!input?.value)return '';
  try{
    return new URL(input.value,location.href).searchParams.get('m')||'';
  }catch{
    return '';
  }
}

let state={
  id:'',
  deployment:null,
  players:[],
  plan:null,
  db:null,
  unsubs:[],
  bindToken:0
};

function clearStateSubs(){
  state.unsubs.forEach(fn=>{try{fn();}catch{}});
  state.unsubs=[];
}

async function findReadableDb(id){
  const apps=getApps();

  for(const app of apps){
    try{
      const auth=getAuth(app);
      if(typeof auth.authStateReady==='function')await auth.authStateReady();
      if(auth.currentUser)return getFirestore(app);
    }catch{}
  }

  const appName=`short-crew-${String(id).replace(/[^A-Za-z0-9_-]/g,'-')}`;
  const app=getApps().find(a=>a.name===appName)||initializeApp(firebaseConfig,appName);
  const auth=getAuth(app);
  if(typeof auth.authStateReady==='function')await auth.authStateReady();
  if(!auth.currentUser)await signInAnonymously(auth);
  return getFirestore(app);
}

function recompute(){
  if(!state.deployment)return;
  state.plan=computeShortCrewPlan(state.players,state.deployment);
  applyPlanToPage();
}

async function bindDeployment(id){
  if(!id||id===state.id)return;
  const token=++state.bindToken;
  clearStateSubs();

  state.id=id;
  state.deployment=null;
  state.players=[];
  state.plan=null;

  try{
    const db=await findReadableDb(id);
    if(token!==state.bindToken)return;
    state.db=db;

    state.unsubs.push(onSnapshot(doc(db,'ufnDeployments',id),snap=>{
      if(!snap.exists())return;
      state.deployment={id:snap.id,...snap.data()};
      recompute();
    }));

    state.unsubs.push(onSnapshot(collection(db,'ufnDeployments',id,'players'),snap=>{
      state.players=snap.docs.map(x=>({id:x.id,...x.data()}));
      recompute();
    }));
  }catch(err){
    console.warn('Short-crew planner could not attach',err);
  }
}

function applyResponseEditor(){
  const selected=document.querySelector('#playerSelect')?.value;
  const box=document.querySelector('#responseEditor');
  if(!selected||!box||!state.plan)return;

  const roles=state.plan.assignments
    .filter(a=>a.playerId===selected)
    .map(a=>a.role);

  let note=box.querySelector('.short-crew-player-summary');
  if(roles.length>1){
    if(!note){
      note=document.createElement('div');
      note.className='short-crew-player-summary';
      const assignment=box.querySelector('.assignment');
      if(assignment)assignment.after(note);
      else box.prepend(note);
    }
    note.textContent=`Combined assignment: ${roles.join(' + ')}`;
  }else{
    note?.remove();
  }
}

function applyResponseStats(){
  const stats=document.querySelector('#responseStats');
  if(!stats||!state.plan||state.plan.error)return;
  const first=state.plan.assignments.filter(a=>a.quality?.rank===1).length;
  const combined=new Set(
    state.plan.assignments
      .filter(a=>Array.isArray(a.bundleRoles)&&a.bundleRoles.length>1)
      .map(a=>a.playerId)
  ).size;
  stats.innerHTML=`<span class="pill">${state.players.length}/${capFor(state.deployment)} responses</span><span class="pill">${first} first-choice station matches</span>${combined?`<span class="pill short-crew-pill">${combined} multi-station crew</span>`:''}`;
}

function applyPlanToPage(){
  if(!state.plan||!state.deployment)return;

  document.querySelectorAll('.station-grid').forEach(grid=>{
    const admin=Boolean(grid.closest('#roster'));
    const html=renderRoster(state.plan,state.deployment,admin);
    if(grid.outerHTML!==html)grid.outerHTML=html;
  });

  applyResponseEditor();
  applyResponseStats();
}

async function downloadShortCrewPdf(){
  if(!state.plan||!state.deployment||state.plan.error)return;
  if(!window.jspdf?.jsPDF){
    alert('PDF generator is unavailable. Refresh and try again.');
    return;
  }

  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const d=state.deployment;
  const ships=shipDefs(d);

  pdf.setFont('helvetica','bold');
  pdf.setFontSize(19);
  pdf.text(d.title||'UFN Deployment',12,14);

  pdf.setFont('helvetica','normal');
  pdf.setFontSize(10);
  pdf.text(dateText(d.date),12,21);
  pdf.text(`${state.players.length}/${capFor(d)} registered`,285,21,{align:'right'});

  const gap=8;
  const cardW=ships.length===1?273:(273-gap)/2;
  const startY=30;

  ships.forEach((ship,i)=>{
    const x=12+i*(cardW+gap);
    const map=new Map(state.plan.assignments.filter(a=>a.shipId===ship.id).map(a=>[a.role,a]));
    const count=crewCount(state.plan,ship.id);
    const summary=shortCrewSummary(state.plan,ship);

    pdf.setDrawColor(130);
    pdf.roundedRect(x,startY,cardW,150,2,2);

    pdf.setFont('helvetica','bold');
    pdf.setFontSize(14);
    pdf.text(ship.name,x+6,startY+10);

    pdf.setFont('helvetica','normal');
    pdf.setFontSize(9);
    pdf.text(`${count}/6 crew`,x+cardW-6,startY+10,{align:'right'});
    if(summary){
      pdf.setFontSize(8);
      pdf.text(summary,x+6,startY+17,{maxWidth:cardW-12});
    }

    const rowStart=summary?startY+31:startY+25;
    ROLES.forEach((r,idx)=>{
      const y=rowStart+idx*19;
      const a=map.get(r.name);
      pdf.setDrawColor(215);
      pdf.line(x+6,y+5,x+cardW-6,y+5);

      pdf.setFont('helvetica','bold');
      pdf.setFontSize(10);
      pdf.text(r.name,x+6,y);

      pdf.setFont('helvetica','normal');
      pdf.setFontSize(10);
      pdf.text(a?.name||'To be decided',x+cardW-6,y,{align:'right'});

      if(a?.combinedLabel){
        pdf.setFontSize(7.5);
        pdf.text(a.combinedLabel,x+cardW-6,y+4,{align:'right'});
      }
    });
  });

  const safe=String(d.title||'UFN-Deployment')
    .replace(/[^a-z0-9-_ ]/gi,'')
    .trim()
    .replace(/\s+/g,'-')||'UFN-Deployment';

  pdf.save(`${safe}_Crew-Manifest.pdf`);

  const message=document.querySelector('#manageMessage');
  if(message){
    message.textContent='Crew PDF downloaded with short-crew assignments.';
    message.className='message ok';
  }
}

document.addEventListener('click',e=>{
  const button=e.target.closest('#downloadCrewPdf');
  if(!button||!state.plan?.hasShortCrew)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  downloadShortCrewPdf().catch(err=>{
    console.error(err);
    alert(`Could not generate crew PDF: ${err.message}`);
  });
},true);

function scan(){
  const id=currentDeploymentId();
  if(id&&id!==state.id)bindDeployment(id);
  if(id&&id===state.id)applyPlanToPage();
}

scan();
new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
