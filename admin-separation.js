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
    if(factions){
      if(patchUrl){
        // Campaign player title bar should mirror the organiser treatment:
        // show the crew patch here as well as on the crew plan.
        if(factions.style.display==='none')factions.style.display='';
        let titlePatch=factions.querySelector('img.campaign-player-patch');
        if(!titlePatch || factions.children.length!==1){
          factions.replaceChildren();
          titlePatch=document.createElement('img');
          titlePatch.className='campaign-player-patch';
          factions.appendChild(titlePatch);
        }
        if(titlePatch.getAttribute('src')!==patchUrl)titlePatch.setAttribute('src',patchUrl);
        const alt=`${crewName} patch`;
        if(titlePatch.getAttribute('alt')!==alt)titlePatch.setAttribute('alt',alt);
      }else{
        // No uploaded patch: leave the base UFN title-bar treatment alone.
        if(factions.style.display==='none')factions.style.display='';
      }
    }

    const rosterPanel=document.querySelector('.roster-panel');
    if(rosterPanel){
      const panelEyebrow=rosterPanel.querySelector(':scope > .eyebrow');
      if(panelEyebrow&&panelEyebrow.textContent!=='Live suggestion')panelEyebrow.textContent='Live suggestion';

      const panelTitle=rosterPanel.querySelector(':scope > h2');
      if(panelTitle&&panelTitle.textContent!=='Current crew plan')panelTitle.textContent='Current crew plan';

      const panelSub=rosterPanel.querySelector(':scope > .sub');
      const wantedSub='All six stations remain visible. Combined stations are shown for short crews.';
      if(panelSub&&panelSub.textContent!==wantedSub)panelSub.textContent=wantedSub;
    }

    const planCard=document.querySelector('.roster-panel .ship-card')||document.querySelector('.station-grid .ship-card');
    if(planCard){
      if(!planCard.classList.contains('campaign-player-plan-mirror')){
        planCard.classList.add('campaign-player-plan-mirror');
      }

      // Mirror the organiser crew-plan header rather than the generic faction card.
      const brand=planCard.querySelector('.ship-brand');
      if(brand){
        const badge=brand.querySelector('.faction-badge');
        badge?.remove();

        const brandCopy=brand.querySelector('.ship-brand-copy');
        if(brandCopy){
          const eyebrow=brandCopy.querySelector('.eyebrow');
          if(eyebrow&&eyebrow.textContent!=='Campaign crew')eyebrow.textContent='Campaign crew';

          const title=brandCopy.querySelector('.ship-title');
          if(title&&title.textContent!=='Current crew plan')title.textContent='Current crew plan';

          const strap=brandCopy.querySelector('.faction-strap');
          if(strap&&strap.textContent!=='LIVE CREW VIEW')strap.textContent='LIVE CREW VIEW';
        }
      }

      let patch=planCard.querySelector('img.campaign-crew-plan-patch');
      if(patchUrl){
        if(!planCard.classList.contains('has-campaign-plan-patch')){
          planCard.classList.add('has-campaign-plan-patch');
        }
        if(!planCard.classList.contains('campaign-watermark-card')){
          planCard.classList.add('campaign-watermark-card');
        }

        const watermarkValue=`url("${patchUrl.replace(/"/g,'%22')}")`;
        if(planCard.style.getPropertyValue('--campaign-watermark-image')!==watermarkValue){
          planCard.style.setProperty('--campaign-watermark-image',watermarkValue);
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
        if(planCard.classList.contains('campaign-watermark-card')){
          planCard.classList.remove('campaign-watermark-card');
        }
        if(planCard.style.getPropertyValue('--campaign-watermark-image')){
          planCard.style.removeProperty('--campaign-watermark-image');
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
