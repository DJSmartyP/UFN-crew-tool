import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const deploymentId=params.get('m');

function hideCampaignCards(ids){
  document.querySelectorAll('#deployments .mission-card').forEach(card=>{
    const manage=card.querySelector('[data-manage]');
    const id=manage?.dataset?.manage;
    if(id&&ids.has(id))card.remove();
  });
  const head=document.querySelector('.page-head .sub');
  if(head&&!deploymentId&&head.textContent!=='Standalone deployments only. Campaign Crew Deployments are managed under Campaign Crews.'){
    head.textContent='Standalone deployments only. Campaign Crew Deployments are managed under Campaign Crews.';
  }
}

async function filterAdminDashboard(){
  const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
  const auth=getAuth(app),db=getFirestore(app);
  onAuthStateChanged(auth,user=>{
    if(!user||user.uid!==ADMIN_UID)return;
    onSnapshot(collection(db,'ufnDeployments'),snap=>{
      const ids=new Set(snap.docs.filter(d=>Boolean(d.data().campaignCrew)).map(d=>d.id));
      hideCampaignCards(ids);
      const main=document.querySelector('#main');
      if(main&&!main.dataset.campaignFilterObserver){
        main.dataset.campaignFilterObserver='1';
        new MutationObserver(()=>hideCampaignCards(ids)).observe(main,{childList:true,subtree:true});
      }
    });
  });
}

async function markCampaignPlayerPage(){
  if(!deploymentId)return;
  const appName=`campaign-marker-${deploymentId}`;
  const app=getApps().find(a=>a.name===appName)||initializeApp(firebaseConfig,appName);
  const auth=getAuth(app),db=getFirestore(app);
  if(typeof auth.authStateReady==='function')await auth.authStateReady();
  if(!auth.currentUser)await signInAnonymously(auth);

  const dep=await getDoc(doc(db,'ufnDeployments',deploymentId));
  if(!dep.exists())return;

  const data=dep.data();
  const topActions=document.querySelector('#topActions');

  if(!data.campaignCrew){
    if(topActions){
      topActions.classList.add('unified-nav-host');
      topActions.innerHTML='<div class="unified-nav"><div class="unified-nav-links"><span class="nav-current">Player deployment</span></div></div>';
    }
    return;
  }

  const slug=data.campaignCrew;
  let crewName=slug,patchUrl='';
  try{
    const publicSnap=await getDoc(doc(db,'ufnCampaignDirectory',slug));
    if(publicSnap.exists())crewName=publicSnap.data().name||slug;
  }catch{}
  try{
    const crewSnap=await getDoc(doc(db,'ufnCampaignCrews',slug));
    if(crewSnap.exists()){
      crewName=crewSnap.data().name||crewName;
      patchUrl=crewSnap.data().patchUrl||'';
    }
  }catch{}

  if(topActions){
    topActions.classList.add('unified-nav-host');
    topActions.innerHTML=`<div class="unified-nav">
      <div class="unified-nav-links">
        <a class="btn ghost tiny nav-link" href="${location.pathname}?crew=${encodeURIComponent(slug)}">← Crew hub</a>
        <span class="nav-current">Player deployment</span>
      </div>
      <div class="unified-nav-account"><span class="pill ufn">${crewName}</span></div>
    </div>`;
  }

  const apply=()=>{
    const banner=document.querySelector('.deployment-visual-copy');
    if(banner){
      const span=banner.querySelector('span');
      const wanted=`CAMPAIGN CREW DEPLOYMENT · ${crewName}`;
      if(span&&span.textContent!==wanted)span.textContent=wanted;

      const small=banner.querySelector('small');
      if(small&&small.textContent.includes('·')){
        const cleaned=small.textContent.split('·')[0].trim();
        if(small.textContent!==cleaned)small.textContent=cleaned;
      }
    }

    const factions=document.querySelector('.deployment-factions');
    if(factions&&patchUrl){
      // Only mutate this once. Re-clearing innerHTML on every observer pass
      // caused a self-triggering render loop on campaign player pages.
      if(factions.childElementCount)factions.replaceChildren();
      if(factions.style.display!=='none')factions.style.display='none';
    }

    const planCard=document.querySelector('.roster-panel .ship-card')||document.querySelector('.station-grid .ship-card');
    if(planCard){
      let patch=planCard.querySelector('img.campaign-crew-plan-patch');
      if(patchUrl){
        if(!planCard.classList.contains('has-campaign-plan-patch')){
          planCard.classList.add('has-campaign-plan-patch');
        }
        if(!patch){
          patch=document.createElement('img');
          patch.className='campaign-crew-plan-patch';
          planCard.appendChild(patch);
        }
        if(patch.getAttribute('src')!==patchUrl)patch.setAttribute('src',patchUrl);
        const alt=`${crewName} patch`;
        if(patch.getAttribute('alt')!==alt)patch.setAttribute('alt',alt);
      }else{
        if(planCard.classList.contains('has-campaign-plan-patch')){
          planCard.classList.remove('has-campaign-plan-patch');
        }
        patch?.remove();
      }
    }

    const head=document.querySelector('.compact-player-head');
    if(head&&!head.querySelector('.campaign-player-marker')){
      const marker=document.createElement('div');
      marker.className='campaign-player-marker';
      marker.innerHTML=`<span class="pill campaign-type">Campaign Crew Deployment</span><span class="pill">${crewName}</span>`;
      head.prepend(marker);
    }

    document.querySelectorAll('.rules .rule').forEach(rule=>{
      if(/Two-ship games/i.test(rule.textContent||''))rule.remove();
    });

    document.querySelectorAll('.ship-title').forEach(el=>{
      if(el.textContent!==crewName)el.textContent=crewName;
    });
  };

  let applyPending=false;
  const scheduleApply=()=>{
    if(applyPending)return;
    applyPending=true;
    requestAnimationFrame(()=>{
      applyPending=false;
      apply();
    });
  };

  apply();
  const main=document.querySelector('#main');
  if(main)new MutationObserver(scheduleApply).observe(main,{childList:true,subtree:true});
}

if(deploymentId)markCampaignPlayerPage().catch(console.error);
else filterAdminDashboard().catch(console.error);
