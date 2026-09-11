import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, onSnapshot, query, where,
  updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';

const params=new URLSearchParams(location.search);
const crewSlug=String(params.get('crew')||'').trim().toLowerCase();
const appName=`campaign-portal-${crewSlug||'unknown'}`;
const app=getApps().find(a=>a.name===appName)||initializeApp(firebaseConfig,appName);
const auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
let crew=null;
let archivedIds=new Set();
let copyTimer=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const localDate=()=>{
  const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

function copyFeedback(btn){
  const original=btn.dataset.copyOriginal||btn.textContent;
  btn.dataset.copyOriginal=original;
  btn.textContent='Copied ✓';
  clearTimeout(copyTimer);
  copyTimer=setTimeout(()=>{if(btn.isConnected)btn.textContent=original;},1400);
}

document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(!btn)return;
  if(/^Copy\b/i.test(btn.textContent||''))setTimeout(()=>copyFeedback(btn),40);
});

function removeLockPlanner(){
  document.querySelector('#crewLock')?.remove();
}

function setPatchVisual(container,url,alt){
  if(!container)return;
  const existing=container.querySelector('img.campaign-patch-banner');
  if(url){
    container.style.display='flex';
    if(!existing||existing.getAttribute('src')!==url){
      container.innerHTML=`<img class="campaign-patch-banner" src="${esc(url)}" alt="${esc(alt||'Campaign crew patch')}">`;
    }
  }else{
    if(container.childElementCount)container.innerHTML='';
    if(container.style.display!=='none')container.style.display='none';
  }
}

function applyPatchVisuals(){
  const url=crew?.patchUrl||'';
  setPatchVisual(document.querySelector('.deployment-factions'),url,`${crew?.name||'Campaign crew'} patch`);

  // Use the campaign patch as the card artwork, matching the faction-art
  // treatment on standard deployments. No patch = no placeholder.
  document.querySelectorAll('#deployments .campaign-deployment-card').forEach(card=>{
    let img=card.querySelector('img.campaign-card-patch');
    if(url){
      if(!img){
        img=document.createElement('img');
        img.className='campaign-card-patch';
        card.appendChild(img);
      }
      if(img.getAttribute('src')!==url)img.setAttribute('src',url);
      img.setAttribute('alt',`${crew?.name||'Campaign crew'} patch`);
    }else img?.remove();
  });

  const head=document.querySelector('.campaign-dashboard-head');
  if(head){
    let holder=head.querySelector('.campaign-hub-patch');
    if(url){
      if(!holder){
        holder=document.createElement('div');
        holder.className='campaign-hub-patch';
        head.appendChild(holder);
      }
      const img=holder.querySelector('img');
      if(!img||img.getAttribute('src')!==url)holder.innerHTML=`<img src="${esc(url)}" alt="${esc(crew?.name||'Campaign crew')} patch">`;
    }else holder?.remove();
  }
}

function filterArchivedCards(){
  document.querySelectorAll('#deployments .mission-card').forEach(card=>{
    const id=card.querySelector('[data-manage]')?.dataset?.manage;
    if(id&&archivedIds.has(id))card.remove();
  });
}

async function archiveDeployment(id,title='this deployment'){
  if(!id)return;
  if(!confirm(`Archive ${title}? It will move to the admin Archive page and can be restored later.`))return;
  await updateDoc(doc(db,'ufnDeployments',id),{
    archived:true,
    archivedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

function wireArchiveButtons(){
  document.querySelectorAll('[data-delete-deployment]').forEach(old=>{
    if(old.dataset.archiveWired==='1')return;
    const id=old.dataset.deleteDeployment;
    if(!id)return;
    const card=old.closest('.mission-card');
    const title=card?.querySelector('h2,h3')?.textContent?.trim()||'this deployment';
    const btn=old.cloneNode(true);
    btn.dataset.archiveWired='1';
    btn.textContent='Archive';
    btn.classList.remove('danger');
    btn.classList.add('ghost');
    btn.onclick=async()=>{
      try{await archiveDeployment(id,title);}
      catch(err){alert(`Could not archive deployment: ${err.message}`);}
    };
    old.replaceWith(btn);
  });

  const old=$('#deleteDeployment');
  if(old&&old.dataset.archiveWired!=='1'){
    const link=$('#manageLink')?.value||'';
    let id='';
    try{id=new URL(link,location.href).searchParams.get('m')||'';}catch{}
    const title=document.querySelector('.deployment-visual-copy b')?.textContent?.trim()||'this deployment';
    const btn=old.cloneNode(true);
    btn.dataset.archiveWired='1';
    btn.textContent='Archive deployment';
    btn.classList.remove('danger');
    btn.classList.add('ghost');
    btn.onclick=async()=>{
      try{
        await archiveDeployment(id,title);
        location.href=`${location.pathname}?crew=${encodeURIComponent(crewSlug)}`;
      }catch(err){alert(`Could not archive deployment: ${err.message}`);}
    };
    old.replaceWith(btn);
  }
}

function defaultDeploymentDate(){
  const input=$('#depDate');
  if(input&&!input.value)input.value=localDate();
}

function addProgressBars(){
  document.querySelectorAll('.campaign-deployment-card').forEach(card=>{
    if(card.querySelector('.response-progress'))return;
    const pill=[...card.querySelectorAll('.mission-meta .pill')].find(x=>/\d+\s*\/\s*6/.test(x.textContent||''));
    if(!pill)return;
    const m=(pill.textContent||'').match(/(\d+)\s*\/\s*6/);
    if(!m)return;
    const n=Math.max(0,Math.min(6,Number(m[1]))),wrap=document.createElement('div');
    wrap.className='response-progress';
    wrap.innerHTML=`<span style="width:${(n/6)*100}%"></span>`;
    pill.parentElement?.after(wrap);
  });
}

async function refreshCrew(){
  const snap=await getDoc(doc(db,'ufnCampaignCrews',crewSlug));
  if(snap.exists())crew={id:snap.id,...snap.data()};
  applyPatchVisuals();
}

function renderPatchSettings(){
  const form=$('#passwordForm');
  if(!form||document.querySelector('.campaign-patch-settings')||!crew)return;
  const box=document.createElement('section');
  box.className='campaign-patch-settings';
  box.innerHTML=`
    <div class="campaign-divider"></div>
    <h3>Crew patch</h3>
    <p class="sub">Upload a PNG, JPG or WebP patch. Maximum file size: 2 MB.</p>
    <div class="campaign-patch-settings-row">
      <div class="campaign-patch-preview">${crew.patchUrl?`<img src="${esc(crew.patchUrl)}" alt="${esc(crew.name)} patch">`:'<span>No patch uploaded</span>'}</div>
      <div class="campaign-patch-controls">
        <input id="campaignPatchFile" type="file" accept="image/png,image/jpeg,image/webp">
        <div class="actions">
          <button id="uploadCampaignPatch" type="button" class="btn primary">Upload patch</button>
          ${crew.patchUrl?'<button id="removeCampaignPatch" type="button" class="btn ghost">Remove patch</button>':''}
        </div>
        <div id="campaignPatchMessage" class="message"></div>
      </div>
    </div>`;
  form.parentElement?.insertBefore(box,form);

  $('#uploadCampaignPatch')?.addEventListener('click',async()=>{
    const file=$('#campaignPatchFile')?.files?.[0],message=$('#campaignPatchMessage');
    if(!file)return message&&(message.textContent='Choose an image first.');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))return message&&(message.textContent='Use PNG, JPG or WebP.');
    if(file.size>2*1024*1024)return message&&(message.textContent='Patch must be 2 MB or smaller.');
    try{
      if(message)message.textContent='Uploading patch…';
      const ref=storageRef(storage,`campaignPatches/${crewSlug}/patch`);
      await uploadBytes(ref,file,{contentType:file.type});
      const url=await getDownloadURL(ref);
      await updateDoc(doc(db,'ufnCampaignCrews',crewSlug),{patchUrl:url,patchUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      crew.patchUrl=url;
      if(message)message.textContent='Patch uploaded ✓';
      box.remove();renderPatchSettings();applyPatchVisuals();
    }catch(err){if(message)message.textContent=`Upload failed: ${err.message}`;}
  });

  $('#removeCampaignPatch')?.addEventListener('click',async()=>{
    if(!confirm('Remove this campaign crew patch?'))return;
    const message=$('#campaignPatchMessage');
    try{
      if(message)message.textContent='Removing patch…';
      await deleteObject(storageRef(storage,`campaignPatches/${crewSlug}/patch`)).catch(()=>{});
      await updateDoc(doc(db,'ufnCampaignCrews',crewSlug),{patchUrl:'',patchUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      crew.patchUrl='';
      box.remove();renderPatchSettings();applyPatchVisuals();
    }catch(err){if(message)message.textContent=`Could not remove patch: ${err.message}`;}
  });
}

function applyUi(){
  removeLockPlanner();
  filterArchivedCards();
  wireArchiveButtons();
  defaultDeploymentDate();
  addProgressBars();
  renderPatchSettings();
  applyPatchVisuals();
}

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{await refreshCrew();}catch{}
  try{
    const q=query(collection(db,'ufnDeployments'),where('campaignCrew','==',crewSlug));
    onSnapshot(q,snap=>{
      archivedIds=new Set(snap.docs.filter(x=>x.data().archived===true).map(x=>x.id));
      applyUi();
    });
  }catch{}
});

applyUi();
new MutationObserver(applyUi).observe(document.body,{childList:true,subtree:true});
