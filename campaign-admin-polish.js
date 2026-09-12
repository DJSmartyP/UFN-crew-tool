import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, onSnapshot, query, where,
  updateDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const adminCrew=String(params.get('adminCrew')||'').trim();
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const main=document.querySelector('#main'),topActions=document.querySelector('#topActions');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=v=>{if(!v)return 'Date not set';const [y,m,d]=String(v).split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));};
const playerUrl=id=>`${location.origin}${location.pathname}?m=${encodeURIComponent(id)}`;
const adminCrewUrl=id=>`${location.pathname}?campaigns=1&adminCrew=${encodeURIComponent(id)}`;
let archivedCrewIds=new Set();
let archivedDeploymentIds=new Set();


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
      await renderAdminCrewHub(d.campaignCrew);
    }catch(err){wrap.querySelector('#adminDepMsg').textContent=err.message;}
  };
}

async function uploadAdminPatch(c,file,message){
  if(message)message.textContent='Preparing patch…';
  const url=await compressPatchFile(file);
  if(message)message.textContent='Saving patch…';
  await updateDoc(doc(db,'ufnCampaignCrews',c.id),{patchUrl:url,patchUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
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
        <div class="actions"><button class="btn primary" data-admin-edit="${esc(d.id)}">Edit</button><button class="btn ghost" data-admin-archive="${esc(d.id)}">Archive</button></div>
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
  if(adminCrew){renderAdminCrewHub(adminCrew).catch(err=>{main.innerHTML=`<section class="empty-state"><h2>Could not open admin hub</h2><p>${esc(err.message)}</p></section>`;});return;}

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
