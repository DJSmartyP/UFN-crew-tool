import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, onSnapshot, query, where,
  updateDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const adminCrew=String(params.get('adminCrew')||'').trim();
const adminDeployment=String(params.get('adminDeployment')||'').trim();
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const main=document.querySelector('#main'),topActions=document.querySelector('#topActions');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=v=>{if(!v)return 'Date not set';const [y,m,d]=String(v).split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));};
const playerUrl=id=>`${location.origin}${location.pathname}?m=${encodeURIComponent(id)}`;
const adminCrewUrl=id=>`${location.pathname}?campaigns=1&adminCrew=${encodeURIComponent(id)}`;
const adminDeploymentUrl=(crewId,depId)=>`${location.pathname}?campaigns=1&adminCrew=${encodeURIComponent(crewId)}&adminDeployment=${encodeURIComponent(depId)}`;
let archivedCrewIds=new Set();
let archivedDeploymentIds=new Set();

const FLEX='__FLEX__';
const FLEX_LABEL='No preference / fill a gap';
const DIRECT_ROLES=[
  {name:'Captain',colour:'command'},
  {name:'Helm',colour:'helm'},
  {name:'Weapons',colour:'weapons'},
  {name:'Engineering',colour:'engineering'},
  {name:'Science',colour:'science'},
  {name:'Relay',colour:'relay'}
];

function prefLabel(value){
  return value===FLEX?FLEX_LABEL:String(value||'');
}
function roleClass(role){
  return `role-${String(role||'').replace(/[^A-Za-z]/g,'')}`;
}
function directQuality(p,role){
  if((p.dislikes||[]).includes(role))return{cost:100000,label:"Really don't want"};
  for(let i=0;i<3;i++){
    const pref=p.prefs?.[i];
    if(pref===FLEX)return{cost:5000,label:'Happy to fill a gap'};
    if(pref===role)return{cost:[0,100,500][i],label:`${i+1}${i===0?'st':i===1?'nd':'rd'} choice`,rank:i+1};
  }
  return{cost:8000,label:'Other available station'};
}
function directPreferredCaptainExtra(p){
  const prefs=(p.prefs||[]).filter(Boolean);
  const captainIndex=prefs.indexOf('Captain');
  if(captainIndex>=0){
    for(let i=captainIndex+1;i<prefs.length;i++){
      if(prefs[i]!==FLEX&&prefs[i]!=='Captain')return prefs[i];
    }
  }
  return prefs.find(role=>role!==FLEX&&role!=='Captain')||'';
}
function directBundles(count){
  if(count===5){
    return DIRECT_ROLES.filter(r=>r.name!=='Captain').map(extra=>{
      const bundles=[['Captain',extra.name]];
      DIRECT_ROLES.filter(r=>r.name!=='Captain'&&r.name!==extra.name).forEach(r=>bundles.push([r.name]));
      return bundles;
    });
  }
  if(count===4){
    return ['Engineering','Science','Relay'].map(extra=>{
      const bundles=[['Captain',extra],['Helm','Weapons']];
      ['Engineering','Science','Relay'].filter(r=>r!==extra).forEach(r=>bundles.push([r]));
      return bundles;
    });
  }
  return [DIRECT_ROLES.map(r=>[r.name]).slice(0,count)];
}
function directBundleCost(p,roles,index){
  let cost=roles.reduce((sum,role)=>sum+directQuality(p,role).cost,0)+index*0.00001;
  if(roles.includes('Captain')&&roles.length>1){
    const extra=roles.find(r=>r!=='Captain')||'';
    const preferred=directPreferredCaptainExtra(p);
    if(preferred&&extra!==preferred)cost+=4500;
  }
  return cost;
}
function solveDirectCrew(players){
  const n=players.length;
  if(!n)return{assignments:[],error:''};

  // Small crew sizes: brute-force bundle assignment. At max 6 this is tiny,
  // deterministic, and keeps this admin view self-contained.
  let patterns;
  if(n===4||n===5)patterns=directBundles(n);
  else{
    const roles=DIRECT_ROLES.map(r=>r.name);
    patterns=[roles.slice(0,n).map(r=>[r])];
  }

  let best=null;
  for(const bundles of patterns){
    if(bundles.length!==n)continue;
    const used=Array(n).fill(false);
    const picks=Array(n);
    function walk(i,total){
      if(best&&total>=best.cost)return;
      if(i===n){
        best={cost:total,picks:picks.map(x=>x.slice())};
        return;
      }
      for(let j=0;j<n;j++){
        if(used[j])continue;
        used[j]=true;
        picks[i]=bundles[j];
        walk(i+1,total+directBundleCost(players[i],bundles[j],i));
        used[j]=false;
      }
    }
    walk(0,0);
  }

  if(!best)return{assignments:[],error:'Could not build the current crew plan.'};

  const assignments=[];
  players.forEach((p,i)=>{
    const roles=best.picks[i];
    roles.forEach(role=>assignments.push({
      playerId:p.id,
      name:p.name,
      role,
      quality:directQuality(p,role),
      combinedLabel:roles.length>1
        ? role==='Captain'
          ? `Also: ${roles.filter(r=>r!=='Captain').join(' + ')}`
          : roles.includes('Captain')
            ? 'Combined with Captain'
            : `Combined with ${roles.filter(r=>r!==role).join(' + ')}`
        : ''
    }));
  });
  return{assignments,error:''};
}
function renderDirectRoster(players){
  const plan=solveDirectCrew(players);
  const map=new Map(plan.assignments.map(a=>[a.role,a]));
  return `<div class="station-grid one admin-direct-roster">
    <section class="ship-card">
      <div class="ship-brand">
        <div class="ship-brand-copy">
          <div class="eyebrow">Campaign crew</div>
          <div class="ship-title">Current crew plan</div>
          <div class="faction-strap">LIVE ADMIN VIEW</div>
        </div>
        <span class="pill ufn">${players.length}/6 crew</span>
      </div>
      ${DIRECT_ROLES.map(r=>{
        const a=map.get(r.name);
        const note=a?[a.combinedLabel,a.quality?.label].filter(Boolean).join(' · '):'';
        return `<div class="station ${roleClass(r.name)}${a?.combinedLabel?' short-crew-combined':''}">
          <div class="station-role">${r.name}</div>
          <div class="station-name">${a?esc(a.name):'<span class="sub">To be decided</span>'}</div>
          ${note?`<div class="station-note">${esc(note)}</div>`:''}
        </div>`;
      }).join('')}
    </section>
  </div>${plan.error?`<div class="message error">${esc(plan.error)}</div>`:''}`;
}


function loadPatchImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read that image.'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('That image could not be opened.'));
      img.onload=()=>resolve(img);
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function compressPatchFile(file){
  if(!file)throw new Error('Choose an image first.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use PNG, JPG or WebP.');
  if(file.size>8*1024*1024)throw new Error('Choose an image smaller than 8 MB. It will be compressed before saving.');
  const img=await loadPatchImage(file);
  let maxEdge=256,quality=.84;
  for(let attempt=0;attempt<6;attempt++){
    const scale=Math.min(1,maxEdge/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
    const height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('This browser could not prepare the patch image.');
    ctx.clearRect(0,0,width,height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,width,height);
    const dataUrl=canvas.toDataURL('image/webp',quality);
    // Keep plenty of headroom below Firestore's 1 MiB document limit.
    if(dataUrl.length<=180000)return dataUrl;
    maxEdge=Math.max(128,Math.round(maxEdge*.82));
    quality=Math.max(.58,quality-.07);
  }
  throw new Error('The patch could not be compressed enough. Try a simpler or smaller image.');
}

async function archiveCrew(id,name){
  if(!confirm(`Archive ${name}? Its deployments will remain in the archive and the crew will disappear from the public crew list.`))return;
  await updateDoc(doc(db,'ufnCampaignCrews',id),{archived:true,active:false,archivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await setDoc(doc(db,'ufnCampaignDirectory',id),{name,active:false,updatedAt:serverTimestamp()},{merge:true});
}

async function archiveDeployment(id,title){
  if(!confirm(`Archive ${title}? It can be restored later from the Archive page.`))return;
  await updateDoc(doc(db,'ufnDeployments',id),{archived:true,archivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
}

function enhanceCampaignAdminList(){
  if(adminCrew)return;
  document.querySelectorAll('[data-crew-deployments] .mission-card').forEach(card=>{
    const id=card.querySelector('[data-admin-copy-player]')?.dataset?.adminCopyPlayer;
    if(id&&archivedDeploymentIds.has(id))card.remove();
  });

  document.querySelectorAll('[data-crew-card]').forEach(card=>{
    const id=card.dataset.crewCard;
    if(archivedCrewIds.has(id)){card.remove();return;}

    // Give every deployment tile direct admin management controls.
    card.querySelectorAll('[data-crew-deployments] .mission-card').forEach(depCard=>{
      const depId=depCard.querySelector('[data-admin-copy-player]')?.dataset?.adminCopyPlayer;
      if(!depId)return;

      let actions=depCard.querySelector('.admin-direct-deployment-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='actions admin-direct-deployment-actions';
        actions.innerHTML=`
          <a class="btn primary" data-admin-direct-manage href="${adminDeploymentUrl(id,depId)}">Manage deployment</a>
          <button class="btn ghost" data-admin-direct-edit type="button">Edit details</button>
          <a class="btn ghost" data-admin-player-page href="${playerUrl(depId)}" target="_blank" rel="noopener">Open player page</a>
          <button class="btn ghost" data-admin-direct-archive type="button">Archive</button>`;
        depCard.appendChild(actions);
      }

      actions.querySelector('[data-admin-direct-edit]')?.addEventListener('click',async e=>{
        e.preventDefault();
        try{
          const snap=await getDoc(doc(db,'ufnDeployments',depId));
          if(!snap.exists())throw new Error('Deployment no longer exists.');
          await editDeployment({id:depId,...snap.data()});
        }catch(err){alert(`Could not edit deployment: ${err.message}`);}
      },{once:true});

      actions.querySelector('[data-admin-direct-archive]')?.addEventListener('click',async e=>{
        e.preventDefault();
        try{
          const title=depCard.querySelector('h2,h3')?.textContent?.trim()||'this deployment';
          await archiveDeployment(depId,title);
          depCard.remove();
        }catch(err){alert(`Could not archive deployment: ${err.message}`);}
      },{once:true});
    });

    const open=card.querySelector('.campaign-admin-actions a.btn.primary');
    if(open){
      const target=adminCrewUrl(id);
      if(open.getAttribute('href')!==target)open.setAttribute('href',target);
      if(open.textContent!=='Open admin hub')open.textContent='Open admin hub';
    }

    const actions=card.querySelector('.campaign-admin-actions');
    if(actions&&!actions.querySelector('[data-archive-crew]')){
      const btn=document.createElement('button');
      btn.className='btn ghost';
      btn.dataset.archiveCrew=id;
      btn.textContent='Archive crew';
      btn.onclick=async e=>{
        e.preventDefault();e.stopPropagation();
        const name=card.querySelector('h2')?.textContent?.trim()||id;
        try{await archiveCrew(id,name);card.remove();}
        catch(err){alert(`Could not archive crew: ${err.message}`);}
      };
      actions.appendChild(btn);
    }

    const remembered=localStorage.getItem('ufnAdminOpenCampaignCrew');
    if(remembered===id&&card.tagName==='DETAILS')card.open=true;
    if(card.tagName==='DETAILS'&&!card.dataset.rememberWired){
      card.dataset.rememberWired='1';
      card.addEventListener('toggle',()=>{
        if(card.open)localStorage.setItem('ufnAdminOpenCampaignCrew',id);
        else if(localStorage.getItem('ufnAdminOpenCampaignCrew')===id)localStorage.removeItem('ufnAdminOpenCampaignCrew');
      });
    }
  });

  const nav=document.querySelector('.campaign-admin-nav');
  if(nav&&!nav.querySelector('#campaignArchiveLink')){
    const link=document.createElement('a');
    link.id='campaignArchiveLink';link.className='btn ghost tiny';link.href=`${location.pathname}?archive=1`;link.textContent='Archive';
    nav.insertBefore(link,nav.lastElementChild);
  }
}

async function editCrewName(c){
  const name=prompt('Campaign crew name',c.name||c.id);
  if(name===null)return false;
  const trimmed=name.trim();
  if(!trimmed)return false;
  await updateDoc(doc(db,'ufnCampaignCrews',c.id),{name:trimmed,updatedAt:serverTimestamp()});
  await setDoc(doc(db,'ufnCampaignDirectory',c.id),{name:trimmed,active:c.active!==false,updatedAt:serverTimestamp()},{merge:true});
  return true;
}

async function editDeployment(d){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<section class="modal panel"><button class="btn ghost tiny modal-close">Close</button><div class="eyebrow">Admin edit</div><h2>Edit campaign deployment</h2><form id="adminEditDeployment"><div class="field"><label>Deployment name</label><input id="adminDepTitle" maxlength="80" required value="${esc(d.title||'')}"></div><div class="field"><label>Date</label><input id="adminDepDate" type="date" required value="${esc(d.date||'')}"></div><div class="actions"><button class="btn primary">Save changes</button></div><div id="adminDepMsg" class="message"></div></form></section>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.modal-close').onclick=()=>wrap.remove();
  wrap.querySelector('#adminEditDeployment').onsubmit=async e=>{
    e.preventDefault();
    try{
      await updateDoc(doc(db,'ufnDeployments',d.id),{title:wrap.querySelector('#adminDepTitle').value.trim(),date:wrap.querySelector('#adminDepDate').value,updatedAt:serverTimestamp()});
      wrap.remove();
      if(adminDeployment&&d.id===adminDeployment)await renderAdminDeploymentPage(d.campaignCrew,d.id);
      else await renderAdminCrewHub(d.campaignCrew);
    }catch(err){wrap.querySelector('#adminDepMsg').textContent=err.message;}
  };
}

async function uploadAdminPatch(c,file,message){
  if(message)message.textContent='Preparing patch…';
  const url=await compressPatchFile(file);
  if(message)message.textContent='Saving patch…';
  await updateDoc(doc(db,'ufnCampaignCrews',c.id),{patchUrl:url,patchUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
}


async function renderAdminDeploymentPage(slug,deploymentId){
  const [cSnap,dSnap]=await Promise.all([
    getDoc(doc(db,'ufnCampaignCrews',slug)),
    getDoc(doc(db,'ufnDeployments',deploymentId))
  ]);

  if(!cSnap.exists()){
    main.innerHTML='<section class="empty-state"><h2>Campaign crew not found</h2></section>';
    return;
  }
  if(!dSnap.exists()){
    main.innerHTML='<section class="empty-state"><h2>Deployment not found</h2><p>It may have been archived or removed.</p></section>';
    return;
  }

  const c={id:cSnap.id,...cSnap.data()};
  const d={id:dSnap.id,...dSnap.data()};
  if(d.campaignCrew!==slug){
    main.innerHTML='<section class="empty-state"><h2>Deployment mismatch</h2><p>This deployment does not belong to that campaign crew.</p></section>';
    return;
  }

  const playersSnap=await getDocs(collection(db,'ufnDeployments',deploymentId,'players'));
  const ps=playersSnap.docs
    .map(x=>({id:x.id,...x.data()}))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

  main.innerHTML=`
    <div class="page-head campaign-dashboard-head admin-direct-head">
      <div class="admin-crew-heading">
        ${c.patchUrl?`<img class="admin-crew-patch" src="${esc(c.patchUrl)}" alt="${esc(c.name||c.id)} patch">`:''}
        <div>
          <div class="eyebrow">Admin deployment management</div>
          <h1>${esc(d.title||'UFN Deployment')}</h1>
          <p class="sub">${esc(c.name||c.id)} · ${esc(dateText(d.date))}</p>
        </div>
      </div>
      <div class="campaign-dashboard-actions">
        <button id="adminDirectEditDeployment" class="btn primary">Edit details</button>
        <a class="btn ghost" href="${playerUrl(d.id)}" target="_blank" rel="noopener">Open player page</a>
        <button id="adminDirectArchiveDeployment" class="btn ghost">Archive</button>
      </div>
    </div>

    <div class="admin-direct-layout">
      <div class="admin-direct-left">
        <section class="panel">
          <div class="eyebrow">Player response link</div>
          <h2>Share link</h2>
          <div class="share-box">
            <input id="adminDirectPlayerLink" readonly value="${esc(playerUrl(d.id))}">
            <button id="adminDirectCopyPlayerLink" class="btn primary tiny">Copy link</button>
          </div>
          <div class="mission-meta" style="margin-top:12px">
            <span class="pill ${d.closed?'closed':'open'}">${d.closed?'Choices closed':'Choices open'}</span>
            <span class="pill">${ps.length}/6 responses</span>
          </div>
        </section>

        <section class="panel">
          <div class="eyebrow">Deployment details</div>
          <dl class="admin-direct-details">
            <dt>Crew</dt><dd>${esc(c.name||c.id)}</dd>
            <dt>Date</dt><dd>${esc(dateText(d.date))}</dd>
            <dt>Deployment ID</dt><dd>${esc(d.id)}</dd>
            <dt>Status</dt><dd>${d.archived?'Archived':d.closed?'Choices closed':'Choices open'}</dd>
          </dl>
        </section>
      </div>

      <section class="panel admin-direct-plan-panel">
        <div class="eyebrow">Live suggestion</div>
        <h2>Current crew plan</h2>
        <p class="sub">All six stations remain visible. Combined stations are shown for short crews.</p>
        ${renderDirectRoster(ps)}
      </section>
    </div>

    <section class="panel admin-direct-responses-panel">
      <div class="eyebrow">Registered crew</div>
      <h2>Responses</h2>
      <div class="admin-direct-player-list">
        ${ps.length?ps.map(p=>`
          <article class="admin-direct-player-row">
            <div class="admin-direct-player-main">
              <strong>${esc(p.name||'Unnamed player')}</strong>
              <div class="admin-direct-pref-list">
                ${(p.prefs||[]).map((pref,i)=>`<span class="pref-tag">${i+1}. ${esc(prefLabel(pref))}</span>`).join('')}
              </div>
              <div class="sub">Really don't want: ${(p.dislikes||[]).length?(p.dislikes||[]).map(esc).join(', '):'None'}</div>
            </div>
          </article>`).join(''):
          '<div class="empty-state"><h3>No responses yet</h3><p>Share the player response link to start collecting preferences.</p></div>'}
      </div>
    </section>`;

  document.querySelector('#adminDirectEditDeployment').onclick=()=>editDeployment(d);
  document.querySelector('#adminDirectCopyPlayerLink').onclick=async e=>{
    await navigator.clipboard.writeText(playerUrl(d.id));
    const btn=e.currentTarget,old=btn.textContent;
    btn.textContent='Copied ✓';
    setTimeout(()=>{if(btn.isConnected)btn.textContent=old;},1200);
  };
  document.querySelector('#adminDirectArchiveDeployment').onclick=async()=>{
    try{
      await archiveDeployment(d.id,d.title||'this deployment');
      location.href=adminCrewUrl(slug);
    }catch(err){alert(`Could not archive deployment: ${err.message}`);}
  };
}

async function renderAdminCrewHub(slug){
  const cSnap=await getDoc(doc(db,'ufnCampaignCrews',slug));
  if(!cSnap.exists()){
    main.innerHTML='<section class="empty-state"><h2>Campaign crew not found</h2></section>';return;
  }
  const c={id:cSnap.id,...cSnap.data()};
  const depSnap=await getDocs(query(collection(db,'ufnDeployments'),where('campaignCrew','==',slug)));
  const ds=depSnap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.archived!==true).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

  main.innerHTML=`
    <div class="page-head campaign-dashboard-head">
      <div class="admin-crew-heading">
        ${c.patchUrl?`<img class="admin-crew-patch" src="${esc(c.patchUrl)}" alt="${esc(c.name)} patch">`:''}
        <div><div class="eyebrow">Admin campaign hub</div><h1>${esc(c.name||c.id)}</h1><p class="sub">Admin access. No campaign password required.</p></div>
      </div>
      <div class="campaign-dashboard-actions"><button id="adminRenameCrew" class="btn ghost">Rename crew</button><button id="adminArchiveCrew" class="btn ghost">Archive crew</button></div>
    </div>
    <section class="panel admin-patch-panel">
      <div><div class="eyebrow">Crew patch</div><h3>${c.patchUrl?'Replace patch':'Upload patch'}</h3><p class="sub">PNG, JPG or WebP. The browser resizes and compresses it before saving to Firestore.</p></div>
      <div class="admin-patch-controls"><input id="adminPatchFile" type="file" accept="image/png,image/jpeg,image/webp"><button id="adminUploadPatch" class="btn primary">${c.patchUrl?'Replace patch':'Upload patch'}</button>${c.patchUrl?'<button id="adminRemovePatch" class="btn ghost">Remove patch</button>':''}</div>
      <div id="adminPatchMessage" class="message"></div>
    </section>
    <div class="campaign-divider"></div>
    <div class="page-head"><div><div class="eyebrow">Campaign Crew Deployments</div><h2>Deployments</h2></div></div>
    <div id="adminCrewDeployments" class="campaign-deployment-grid">${ds.length?ds.map(d=>`
      <section class="panel mission-card campaign-deployment-card">
        <div class="campaign-card-badges"><span class="pill campaign-type">Campaign Crew Deployment</span></div>
        ${c.patchUrl?`<img class="campaign-card-patch" src="${esc(c.patchUrl)}" alt="${esc(c.name||c.id)} patch">`:''}
        <div class="mission-date">${esc(dateText(d.date))}</div><h3>${esc(d.title||'UFN Deployment')}</h3>
        <div class="mission-meta"><span class="pill ${d.closed?'closed':'open'}">${d.closed?'Choices closed':'Choices open'}</span><span class="pill">${Number(d.responseCount||0)}/6 responses</span></div>
        <div class="share-box"><input readonly value="${esc(playerUrl(d.id))}"><button class="btn ghost tiny" data-admin-copy="${esc(d.id)}">Copy player link</button></div>
        <div class="actions">
          <a class="btn primary" href="${adminDeploymentUrl(slug,d.id)}">Manage deployment</a>
          <button class="btn ghost" data-admin-edit="${esc(d.id)}">Edit details</button>
          <a class="btn ghost" href="${playerUrl(d.id)}" target="_blank" rel="noopener">Open player page</a>
          <button class="btn ghost" data-admin-archive="${esc(d.id)}">Archive</button>
        </div>
      </section>`).join(''):'<section class="empty-state"><h3>No active deployments</h3><p>Archived deployments are on the Archive page.</p></section>'}</div>`;

  document.querySelector('#adminRenameCrew').onclick=async()=>{try{if(await editCrewName(c))await renderAdminCrewHub(slug);}catch(err){alert(err.message);}};
  document.querySelector('#adminArchiveCrew').onclick=async()=>{try{await archiveCrew(c.id,c.name||c.id);location.href=`${location.pathname}?campaigns=1`;}catch(err){alert(err.message);}};
  document.querySelector('#adminUploadPatch').onclick=async()=>{
    const message=document.querySelector('#adminPatchMessage');
    try{await uploadAdminPatch(c,document.querySelector('#adminPatchFile')?.files?.[0],message);await renderAdminCrewHub(slug);}catch(err){if(message)message.textContent=err.message;}
  };
  document.querySelector('#adminRemovePatch')?.addEventListener('click',async()=>{
    if(!confirm('Remove this campaign crew patch?'))return;
    const message=document.querySelector('#adminPatchMessage');
    try{
      await updateDoc(doc(db,'ufnCampaignCrews',c.id),{patchUrl:'',patchUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      await renderAdminCrewHub(slug);
    }catch(err){if(message)message.textContent=err.message;}
  });
  ds.forEach(d=>{
    document.querySelector(`[data-admin-copy="${CSS.escape(d.id)}"]`)?.addEventListener('click',async e=>{await navigator.clipboard.writeText(playerUrl(d.id));const b=e.currentTarget,o=b.textContent;b.textContent='Copied ✓';setTimeout(()=>b.textContent=o,1200);});
    document.querySelector(`[data-admin-edit="${CSS.escape(d.id)}"]`)?.addEventListener('click',()=>editDeployment(d));
    document.querySelector(`[data-admin-archive="${CSS.escape(d.id)}"]`)?.addEventListener('click',async()=>{try{await archiveDeployment(d.id,d.title||'this deployment');await renderAdminCrewHub(slug);}catch(err){alert(err.message);}});
  });
}

onAuthStateChanged(auth,user=>{
  if(!user||user.uid!==ADMIN_UID)return;
  if(adminCrew&&adminDeployment){
    renderAdminDeploymentPage(adminCrew,adminDeployment).catch(err=>{
      main.innerHTML=`<section class="empty-state"><h2>Could not open deployment</h2><p>${esc(err.message)}</p></section>`;
    });
    return;
  }
  if(adminCrew){
    renderAdminCrewHub(adminCrew).catch(err=>{
      main.innerHTML=`<section class="empty-state"><h2>Could not open admin hub</h2><p>${esc(err.message)}</p></section>`;
    });
    return;
  }

  onSnapshot(collection(db,'ufnCampaignCrews'),snap=>{
    archivedCrewIds=new Set(snap.docs.filter(x=>x.data().archived===true).map(x=>x.id));
    enhanceCampaignAdminList();
  });
  onSnapshot(collection(db,'ufnDeployments'),snap=>{
    archivedDeploymentIds=new Set(snap.docs.filter(x=>x.data().archived===true).map(x=>x.id));
    enhanceCampaignAdminList();
  });
  enhanceCampaignAdminList();
  new MutationObserver(enhanceCampaignAdminList).observe(document.body,{childList:true,subtree:true});
});
