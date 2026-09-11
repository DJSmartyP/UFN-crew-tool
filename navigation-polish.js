import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const params=new URLSearchParams(location.search);
const topActions=document.querySelector('#topActions');
const main=document.querySelector('#main');
const path=location.pathname;

const isPlayer=params.has('m');
const isCampaignHub=params.has('crew');
const isCampaignDirectory=params.has('campaign')&&!params.has('campaigns');
const isCampaignAdmin=params.has('campaigns');
const isArchive=params.has('archive');
const isRootAdmin=!isPlayer&&!isCampaignHub&&!isCampaignDirectory&&!isCampaignAdmin&&!isArchive;

function adminNav(active){
  return `<div class="unified-nav">
    <div class="unified-nav-links">
      <a class="btn ghost tiny nav-link${active==='deployments'?' nav-active':''}" href="${path}">Deployments</a>
      <a class="btn ghost tiny nav-link${active==='campaigns'?' nav-active':''}" href="${path}?campaigns=1">Campaign crews</a>
      <a class="btn ghost tiny nav-link" href="${path}?campaign=1">Crew access</a>
      <a class="btn ghost tiny nav-link${active==='archive'?' nav-active':''}" href="${path}?archive=1">Archive</a>
    </div>
    <div class="unified-nav-account">
      <span class="pill ufn">UFN administrator</span>
      <button id="unifiedSignOut" class="btn ghost tiny">Sign out</button>
    </div>
  </div>`;
}

function wireAdminNav(active){
  if(!topActions)return;
  topActions.classList.add('unified-nav-host');
  topActions.innerHTML=adminNav(active);
  document.querySelector('#unifiedSignOut')?.addEventListener('click',async()=>{
    try{
      const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
      await signOut(getAuth(app));
    }catch{}
  });
}

function polishPublicNav(){
  if(!topActions)return;
  topActions.classList.add('unified-nav-host');

  if(isCampaignDirectory){
    const wanted='<div class="unified-nav"><div class="unified-nav-links"><span class="nav-current">Campaign crews</span></div></div>';
    if(topActions.innerHTML!==wanted)topActions.innerHTML=wanted;
  }

  if(isCampaignHub){
    const first=topActions.querySelector('a[href*="?campaign=1"]');
    if(first&&first.textContent!=='← Campaign crews')first.textContent='← Campaign crews';
  }
}

function polishBackButtons(){
  const back=document.querySelector('#backDash');
  if(back){
    const wanted=isCampaignHub?'← Campaign hub':'← Deployments';
    if(back.textContent!==wanted)back.textContent=wanted;
  }
  document.querySelectorAll('.modal-close').forEach(btn=>{
    if(!btn.getAttribute('aria-label'))btn.setAttribute('aria-label','Close dialog');
  });
}

function apply(){
  polishPublicNav();
  polishBackButtons();
}

if(isRootAdmin||isCampaignAdmin||isArchive){
  const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
  const auth=getAuth(app);
  onAuthStateChanged(auth,user=>{
    if(!user||user.uid!==ADMIN_UID)return;
    wireAdminNav(isRootAdmin?'deployments':isArchive?'archive':'campaigns');
  });
}else{
  apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
}
