import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, updateDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const main=document.querySelector('#main'),topActions=document.querySelector('#topActions');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=v=>{if(!v)return 'Date not set';const [y,m,d]=String(v).split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));};

function renderLogin(){
  topActions.innerHTML='';
  main.innerHTML=`<section class="admin-entry-shell"><div class="admin-entry-card"><div class="eyebrow">UFN ADMINISTRATION</div><h1>Archive</h1><p>Sign in with the UFN administrator account.</p><button id="archiveLogin" class="btn admin-google">Continue with Google</button></div></section>`;
  document.querySelector('#archiveLogin').onclick=()=>signInWithPopup(auth,new GoogleAuthProvider());
}
function renderWrong(){
  topActions.innerHTML='';
  main.innerHTML=`<section class="empty-state"><h2>Account not authorised</h2><button id="archiveLogout" class="btn ghost">Sign out</button></section>`;
  document.querySelector('#archiveLogout').onclick=()=>signOut(auth);
}
async function restoreDeployment(id){
  await updateDoc(doc(db,'ufnDeployments',id),{archived:false,restoredAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await renderArchive();
}
async function restoreCrew(c){
  await updateDoc(doc(db,'ufnCampaignCrews',c.id),{archived:false,active:true,restoredAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await setDoc(doc(db,'ufnCampaignDirectory',c.id),{name:c.name||c.id,active:true,updatedAt:serverTimestamp()},{merge:true});
  await renderArchive();
}
async function renderArchive(){
  topActions.innerHTML=`<div class="campaign-admin-nav"><a class="btn ghost tiny" href="${location.pathname}">← Deployments</a><a class="btn ghost tiny" href="${location.pathname}?campaigns=1">Campaign crews</a><span class="pill ufn">UFN administrator</span></div>`;
  main.innerHTML='<section class="loading-card"><div class="scanner"></div><p>Loading archive…</p></section>';
  const [depSnap,crewSnap]=await Promise.all([getDocs(collection(db,'ufnDeployments')),getDocs(collection(db,'ufnCampaignCrews'))]);
  const deployments=depSnap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.archived===true).sort((a,b)=>String(b.archivedAt?.seconds||0).localeCompare(String(a.archivedAt?.seconds||0)));
  const crews=crewSnap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.archived===true).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id)));
  const crewNames=new Map(crewSnap.docs.map(x=>[x.id,x.data().name||x.id]));

  main.innerHTML=`<div class="page-head"><div><div class="eyebrow">UFN administrator</div><h1>Archive</h1><p class="sub">Archived items are hidden from normal screens. Restore anything here if it was removed by mistake.</p></div></div>
    <section class="panel archive-panel"><h2>Archived campaign crews</h2><div class="archive-text-list">${crews.length?crews.map(c=>`<div class="archive-row"><span><b>${esc(c.name||c.id)}</b> <small>Campaign crew</small></span><button class="btn ghost tiny" data-restore-crew="${esc(c.id)}">Restore</button></div>`).join(''):'<p class="sub">No archived campaign crews.</p>'}</div></section>
    <section class="panel archive-panel"><h2>Archived deployments</h2><div class="archive-text-list">${deployments.length?deployments.map(d=>`<div class="archive-row"><span><b>${esc(d.title||'UFN Deployment')}</b> <small>${esc(dateText(d.date))}${d.campaignCrew?` · ${esc(crewNames.get(d.campaignCrew)||d.campaignCrew)} · Campaign`: ' · Standalone'}</small></span><button class="btn ghost tiny" data-restore-deployment="${esc(d.id)}">Restore</button></div>`).join(''):'<p class="sub">No archived deployments.</p>'}</div></section>`;
  crews.forEach(c=>document.querySelector(`[data-restore-crew="${CSS.escape(c.id)}"]`)?.addEventListener('click',()=>restoreCrew(c).catch(err=>alert(err.message))));
  deployments.forEach(d=>document.querySelector(`[data-restore-deployment="${CSS.escape(d.id)}"]`)?.addEventListener('click',()=>restoreDeployment(d.id).catch(err=>alert(err.message))));
}

onAuthStateChanged(auth,user=>{
  if(!user)return renderLogin();
  if(user.uid!==ADMIN_UID)return renderWrong();
  renderArchive().catch(err=>{main.innerHTML=`<section class="empty-state"><h2>Could not load archive</h2><p>${esc(err.message)}</p></section>`;});
});
