import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const main=document.querySelector('#main');
const topActions=document.querySelector('#topActions');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
const db=getFirestore(app);

topActions.innerHTML='<span class="pill ufn">Campaign Crew Access</span>';

async function boot(){
  main.innerHTML=`<div class="page-head"><div><div class="eyebrow">UFN Campaign Crews</div><h1>Choose your campaign crew</h1><p class="sub">Select your crew, then enter its shared password to open the campaign hub.</p></div></div><div id="campaignDirectory" class="campaign-directory-grid"><section class="loading-card"><div class="scanner"></div><p>Loading campaign crews…</p></section></div>`;
  try{
    const snap=await getDocs(collection(db,'ufnCampaignDirectory'));
    const crews=snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.active!==false).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id)));
    const box=document.querySelector('#campaignDirectory');
    box.innerHTML=crews.length?crews.map(c=>`<section class="panel campaign-directory-card"><div class="eyebrow">Campaign crew</div><h2>${esc(c.name||c.id)}</h2><p class="sub">Campaign deployment hub</p><div class="actions"><a class="btn primary" href="${location.pathname}?crew=${encodeURIComponent(c.id)}">Choose this crew</a></div></section>`).join(''):`<section class="empty-state"><h2>No campaign crews available</h2><p>Ask the UFN administrator to create or enable your campaign crew.</p></section>`;
  }catch(err){
    document.querySelector('#campaignDirectory').innerHTML=`<section class="empty-state"><h2>Could not load campaign crews</h2><p>${esc(err.message)}</p></section>`;
  }
}
boot();
