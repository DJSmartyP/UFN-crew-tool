import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const deploymentId=params.get('m');
let hiddenIds=new Set();

function parseManageId(){
  const value=document.querySelector('#manageLink')?.value||'';
  try{return new URL(value,location.href).searchParams.get('m')||'';}catch{return '';}
}

async function archiveDeployment(db,id,title){
  if(!id)return;
  if(!confirm(`Archive ${title}? It will move to the Archive page and can be restored later.`))return;
  await updateDoc(doc(db,'ufnDeployments',id),{archived:true,archivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
}

function hideSeparatedCards(){
  document.querySelectorAll('#deployments .mission-card').forEach(card=>{
    const manage=card.querySelector('[data-manage]');
    const id=manage?.dataset?.manage;
    if(id&&hiddenIds.has(id))card.remove();
  });
  const head=document.querySelector('.page-head .sub');
  const label='Standalone deployments only. Campaign Crew Deployments are managed under Campaign Crews.';
  if(head&&!deploymentId&&head.textContent!==label)head.textContent=label;
}

function wireStandaloneArchive(db){
  document.querySelectorAll('#deployments [data-delete-deployment]').forEach(old=>{
    if(old.dataset.archiveWired==='1')return;
    const id=old.dataset.deleteDeployment;
    if(!id||hiddenIds.has(id))return;
    const title=old.closest('.mission-card')?.querySelector('h2,h3')?.textContent?.trim()||'this deployment';
    const btn=old.cloneNode(true);
    btn.dataset.archiveWired='1';
    btn.textContent='Archive';
    btn.classList.remove('danger');btn.classList.add('ghost');
    btn.onclick=async()=>{try{await archiveDeployment(db,id,title);}catch(err){alert(`Could not archive deployment: ${err.message}`);}};
    old.replaceWith(btn);
  });

  const old=document.querySelector('#deleteDeployment');
  if(old&&old.dataset.archiveWired!=='1'){
    const id=parseManageId();
    if(id&&!hiddenIds.has(id)){
      const title=document.querySelector('.deployment-visual-copy b')?.textContent?.trim()||'this deployment';
      const btn=old.cloneNode(true);
      btn.dataset.archiveWired='1';
      btn.textContent='Archive deployment';
      btn.classList.remove('danger');btn.classList.add('ghost');
      btn.onclick=async()=>{
        try{await archiveDeployment(db,id,title);location.href=location.pathname;}
        catch(err){alert(`Could not archive deployment: ${err.message}`);}
      };
      old.replaceWith(btn);
    }
  }
}

async function filterAdminDashboard(){
  const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
  const auth=getAuth(app),db=getFirestore(app);
  onAuthStateChanged(auth,user=>{
    if(!user||user.uid!==ADMIN_UID)return;
    onSnapshot(collection(db,'ufnDeployments'),snap=>{
      hiddenIds=new Set(snap.docs.filter(d=>Boolean(d.data().campaignCrew)||d.data().archived===true).map(d=>d.id));
      hideSeparatedCards();wireStandaloneArchive(db);
      const main=document.querySelector('#main');
      if(main&&!main.dataset.campaignFilterObserver){
        main.dataset.campaignFilterObserver='1';
        new MutationObserver(()=>{hideSeparatedCards();wireStandaloneArchive(db);}).observe(main,{childList:true,subtree:true});
      }
    });
  });
}

async function markPlayerPage(){
  if(!deploymentId)return;
  const appName=`campaign-marker-${deploymentId}`;
  const app=getApps().find(a=>a.name===appName)||initializeApp(firebaseConfig,appName);
  const auth=getAuth(app),db=getFirestore(app);
  if(typeof auth.authStateReady==='function')await auth.authStateReady();
  if(!auth.currentUser)await signInAnonymously(auth);
  const dep=await getDoc(doc(db,'ufnDeployments',deploymentId));
  if(!dep.exists())return;
  const d=dep.data();

  if(d.archived===true){
    const enforce=()=>{
      const main=document.querySelector('#main');
      if(!main||main.querySelector('[data-archived-deployment]'))return;
      main.innerHTML='<section class="empty-state" data-archived-deployment><h2>Deployment unavailable</h2><p>This deployment has been archived. Ask your organiser for the current player link.</p></section>';
    };
    enforce();
    const main=document.querySelector('#main');
    if(main)new MutationObserver(enforce).observe(main,{childList:true,subtree:true});
    return;
  }
  if(!d.campaignCrew)return;

  const slug=d.campaignCrew;
  let crewName=slug,patchUrl='',crewUnavailable=false;
  try{
    const c=await getDoc(doc(db,'ufnCampaignCrews',slug));
    if(c.exists()){
      crewName=c.data().name||slug;
      patchUrl=c.data().patchUrl||'';
      crewUnavailable=c.data().active===false||c.data().archived===true;
    }
  }catch{}
  if(crewUnavailable){
    const enforce=()=>{
      const main=document.querySelector('#main');
      if(!main||main.querySelector('[data-archived-deployment]'))return;
      main.innerHTML='<section class="empty-state" data-archived-deployment><h2>Campaign unavailable</h2><p>This campaign crew has been archived or disabled. Ask the organiser for the current campaign details.</p></section>';
    };
    enforce();
    const main=document.querySelector('#main');
    if(main)new MutationObserver(enforce).observe(main,{childList:true,subtree:true});
    return;
  }

  const apply=()=>{
    const banner=document.querySelector('.deployment-visual-copy');
    if(banner){
      const span=banner.querySelector('span');
      const text=`CAMPAIGN CREW DEPLOYMENT · ${crewName}`;
      if(span&&span.textContent!==text)span.textContent=text;
      const small=banner.querySelector('small');
      if(small&&small.textContent.includes('·'))small.textContent=small.textContent.split('·')[0].trim();
    }
    const graphic=document.querySelector('.deployment-factions');
    if(graphic){
      const existing=graphic.querySelector('img.campaign-patch-banner');
      if(patchUrl){
        graphic.style.display='flex';
        if(!existing||existing.src!==patchUrl)graphic.innerHTML=`<img class="campaign-patch-banner" src="${patchUrl}" alt="${crewName} patch">`;
      }else{
        if(graphic.childElementCount)graphic.innerHTML='';
        graphic.style.display='none';
      }
    }
    const head=document.querySelector('.compact-player-head');
    if(head&&!head.querySelector('.campaign-player-marker')){
      const marker=document.createElement('div');
      marker.className='campaign-player-marker';
      marker.innerHTML=`<span class="pill campaign-type">Campaign Crew Deployment</span><span class="pill">${crewName}</span>`;
      head.prepend(marker);
    }
    document.querySelectorAll('.rules .rule').forEach(rule=>{if(/Two-ship games/i.test(rule.textContent||''))rule.remove();});
    document.querySelectorAll('.ship-title').forEach(el=>{if(el.textContent!==crewName)el.textContent=crewName;});
  };
  apply();
  const main=document.querySelector('#main');
  if(main)new MutationObserver(apply).observe(main,{childList:true,subtree:true});
}

if(deploymentId)markPlayerPage().catch(console.error);
else filterAdminDashboard().catch(console.error);
