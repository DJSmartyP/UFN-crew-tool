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
  if(head&&!deploymentId)head.textContent='Standalone deployments only. Campaign Crew Deployments are managed under Campaign Crews.';
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
  if(!dep.exists()||!dep.data().campaignCrew)return;
  const slug=dep.data().campaignCrew;
  let crewName=slug;
  try{
    const pub=await getDoc(doc(db,'ufnCampaignDirectory',slug));
    if(pub.exists())crewName=pub.data().name||slug;
  }catch{}
  const apply=()=>{
    const banner=document.querySelector('.deployment-visual-copy');
    if(banner){
      const span=banner.querySelector('span');
      if(span)span.textContent=`CAMPAIGN CREW DEPLOYMENT · ${crewName}`;
      const small=banner.querySelector('small');
      if(small&&small.textContent.includes('·'))small.textContent=small.textContent.split('·')[0].trim();
    }
    const head=document.querySelector('.compact-player-head');
    if(head&&!head.querySelector('.campaign-player-marker')){
      const marker=document.createElement('div');
      marker.className='campaign-player-marker';
      marker.innerHTML=`<span class="pill campaign-type">Campaign Crew Deployment</span><span class="pill">${crewName}</span>`;
      head.prepend(marker);
    }
    document.querySelectorAll('.rules .rule').forEach(rule=>{if(/Two-ship games/i.test(rule.textContent||''))rule.remove();});
    document.querySelectorAll('.ship-title').forEach(el=>{el.textContent=crewName;});
  };
  apply();
  const main=document.querySelector('#main');
  if(main)new MutationObserver(apply).observe(main,{childList:true,subtree:true});
}
if(deploymentId)markCampaignPlayerPage().catch(console.error);
else filterAdminDashboard().catch(console.error);
