import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps, deleteApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  createUserWithEmailAndPassword, deleteUser
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
  serverTimestamp, query, orderBy, where
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = s => document.querySelector(s);
const main = $('#main');
const topActions = $('#topActions');
const adminCrewParam = new URLSearchParams(location.search).get('adminCrew');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify = s => String(s || '').normalize('NFKD').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;

function msg(el,text,type=''){ if(!el)return; el.textContent=text||''; el.className=`message${type?` ${type}`:''}`; }
function crewUrl(slug){ return `${location.origin}${location.pathname}?crew=${encodeURIComponent(slug)}`; }
function campaignAccessUrl(){ return `${location.origin}${location.pathname}?campaign=1`; }
function playerUrl(id){ return `${location.origin}${location.pathname}?m=${encodeURIComponent(id)}`; }
function dateText(v){if(!v)return 'Date not set';const [y,m,d]=String(v).split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));}
async function syncPublicDirectory(c){
  await setDoc(doc(db,'ufnCampaignDirectory',c.id||c.slug),{
    name:c.name||c.id||c.slug,
    active:c.active!==false,
    updatedAt:serverTimestamp()
  },{merge:true});
}
async function uniqueCrewSlug(name){
  const base=slugify(name)||'campaign-crew';
  let slug=base,n=2;
  while((await getDoc(doc(db,'ufnCampaignCrews',slug))).exists()){
    slug=`${base}-${n++}`;
    if(n>99)throw new Error('Could not generate a unique campaign crew identifier.');
  }
  return slug;
}
function randomInternalEmail(){
  const id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g,'');
  return `campaign-${id}@accounts.ufn.invalid`;
}
async function createCredentialAccount(password){
  const appName = `crew-credential-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempApp = initializeApp(firebaseConfig, appName);
  const tempAuth = getAuth(tempApp);
  const email = randomInternalEmail();
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    return { tempApp, tempAuth, user: cred.user, email };
  } catch (e) {
    await deleteApp(tempApp).catch(()=>{});
    throw e;
  }
}
async function disposeCredentialAccount(bundle,{deleteCreated=false}={}){
  if(!bundle)return;
  try { if(deleteCreated && bundle.user) await deleteUser(bundle.user); } catch {}
  try { await signOut(bundle.tempAuth); } catch {}
  try { await deleteApp(bundle.tempApp); } catch {}
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (!user) return renderLogin();
  if (user.uid !== ADMIN_UID) return renderWrongAccount();

  // The campaign list owns its legacy header. An individual admin crew hub is
  // rendered by campaign-admin-polish.js and the unified navigation layer.
  // Do not let this module overwrite that header after the hub has opened.
  if (!adminCrewParam) {
    renderTop();
    renderCampaignAdmin();
  }
});

function renderTop(){
  topActions.innerHTML = `<div class="campaign-admin-nav"><a class="btn ghost tiny" href="${location.pathname}">← Standalone deployments</a><a class="btn ghost tiny" href="${campaignAccessUrl()}">Crew access page</a><span class="pill ufn">UFN administrator</span><button id="logout" class="btn ghost tiny">Sign out</button></div>`;
  $('#logout').onclick = () => signOut(auth);
}
function renderLogin(){
  topActions.innerHTML='';
  main.innerHTML=`<section class="admin-entry-shell"><div class="admin-entry-card"><div class="eyebrow">UFN CAMPAIGN ADMINISTRATION</div><h1>Campaign crew administration</h1><p>Sign in with the existing UFN administrator account.</p><button id="googleLogin" class="btn admin-google">Continue with Google</button><div id="loginMessage" class="message"></div></div></section>`;
  $('#googleLogin').onclick=async()=>{ try{ await signInWithPopup(auth,new GoogleAuthProvider()); }catch(e){ msg($('#loginMessage'),e.message,'error'); } };
}
function renderWrongAccount(){
  topActions.innerHTML='';
  main.innerHTML=`<section class="empty-state"><h2>Account not authorised</h2><p>Campaign crew administration is restricted to the UFN administrator.</p><div class="actions" style="justify-content:center"><button id="wrongLogout" class="btn ghost">Sign out</button></div></section>`;
  $('#wrongLogout').onclick=()=>signOut(auth);
}

async function renderCampaignAdmin(){
  main.innerHTML=`<div class="page-head campaign-dashboard-head"><div><div class="eyebrow">UFN administrator</div><h1>Campaign crews</h1><p class="sub">Campaign deployments are kept here, grouped under their campaign crew. Open a crew to see its deployments.</p></div><div class="campaign-dashboard-actions"><a class="btn ghost" href="${campaignAccessUrl()}">Crew access page</a><button id="newCrew" class="btn primary">Create campaign crew</button></div></div><div id="crewList" class="campaign-accordion-list"><section class="loading-card"><div class="scanner"></div><p>Loading campaign crews…</p></section></div>`;
  $('#newCrew').onclick=openCreateCrewModal;
  try{
    const snap=await getDocs(query(collection(db,'ufnCampaignCrews'),orderBy('name')));
    const crews=snap.docs.map(d=>({id:d.id,...d.data()}));
    $('#crewList').innerHTML=crews.length?crews.map(renderCrewCard).join(''):`<section class="empty-state"><h2>No campaign crews yet</h2><p>Create the first campaign crew system.</p></section>`;
    await Promise.allSettled(crews.map(syncPublicDirectory));
    crews.forEach(bindCrewCard);
  }catch(e){
    $('#crewList').innerHTML=`<section class="empty-state"><h2>Could not load campaign crews</h2><p>${esc(e.message)}</p></section>`;
  }
}
function renderCrewCard(c){
  return `<details class="panel campaign-card campaign-crew-accordion" data-crew-card="${esc(c.id)}"><summary><div class="campaign-summary-main"><div><div class="eyebrow">Campaign crew</div><h2>${esc(c.name||c.id)}</h2></div><div class="campaign-summary-meta"><span class="pill ${c.active===false?'closed':'open'}">${c.active===false?'Disabled':'Active'}</span><span class="pill">Password v${Number(c.passwordVersion||1)}</span><span class="campaign-chevron">⌄</span></div></div></summary><div class="campaign-accordion-body"><div class="actions campaign-admin-actions"><a class="btn primary" href="${location.pathname}?campaigns=1&adminCrew=${encodeURIComponent(c.id)}">Open admin hub</a><button class="btn ghost" data-reset-password="${esc(c.id)}">Set new password</button><button class="btn ${c.active===false?'success':'danger'}" data-toggle-crew="${esc(c.id)}">${c.active===false?'Enable':'Disable'}</button></div><div class="campaign-divider"></div><div class="panel-heading-actions"><div><div class="eyebrow">Campaign Crew Deployments</div><h3>Deployments</h3></div></div><div class="campaign-deployment-grid" data-crew-deployments="${esc(c.id)}"><section class="loading-card"><p>Open this crew to load deployments…</p></section></div></div></details>`;
}
function bindCrewCard(c){
  const card=document.querySelector(`[data-crew-card="${CSS.escape(c.id)}"]`);
  document.querySelector(`[data-reset-password="${CSS.escape(c.id)}"]`)?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openResetPasswordModal(c);});
  document.querySelector(`[data-toggle-crew="${CSS.escape(c.id)}"]`)?.addEventListener('click',async e=>{
    e.preventDefault();e.stopPropagation();
    const next=c.active===false;
    if(!confirm(`${next?'Enable':'Disable'} ${c.name}?`))return;
    await updateDoc(doc(db,'ufnCampaignCrews',c.id),{active:next,updatedAt:serverTimestamp()});
    await syncPublicDirectory({...c,active:next});
    renderCampaignAdmin();
  });
  card?.addEventListener('toggle',()=>{if(card.open)loadCrewDeployments(c);});
}
async function loadCrewDeployments(c){
  const box=document.querySelector(`[data-crew-deployments="${CSS.escape(c.id)}"]`);
  if(!box||box.dataset.loaded==='1')return;
  box.dataset.loaded='1';
  box.innerHTML='<section class="loading-card"><p>Loading deployments…</p></section>';
  try{
    const snap=await getDocs(query(collection(db,'ufnDeployments'),where('campaignCrew','==',c.id)));
    const ds=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    box.innerHTML=ds.length?ds.map(d=>`<section class="panel mission-card campaign-deployment-card"><div class="campaign-card-badges"><span class="pill campaign-type">Campaign Crew Deployment</span></div><div class="mission-date">${esc(dateText(d.date))}</div><h3>${esc(d.title||'UFN Deployment')}</h3><p class="sub">${esc(c.name)}</p><div class="mission-meta"><span class="pill ${d.closed?'closed':'open'}">${d.closed?'Choices closed':'Choices open'}</span><span class="pill">${Number(d.responseCount||0)}/6 responses</span></div><div class="share-box"><input readonly value="${esc(playerUrl(d.id))}"><button class="btn ghost tiny" data-admin-copy-player="${esc(d.id)}">Copy player link</button></div></section>`).join(''):`<section class="empty-state"><h3>No campaign deployments yet</h3><p>This crew can create deployments from its campaign hub.</p></section>`;
    ds.forEach(d=>document.querySelector(`[data-admin-copy-player="${CSS.escape(d.id)}"]`)?.addEventListener('click',()=>navigator.clipboard.writeText(playerUrl(d.id))));
  }catch(err){
    box.innerHTML=`<section class="empty-state"><h3>Could not load deployments</h3><p>${esc(err.message)}</p></section>`;
  }
}

function passwordFieldMarkup(defaultValue='sxpgames'){
  return `<div class="field"><label>Shared campaign password</label><div class="campaign-password-row"><input id="crewPassword" type="password" minlength="6" autocomplete="new-password" required value="${esc(defaultValue)}"><button id="togglePassword" type="button" class="btn ghost tiny">Show</button></div><div class="campaign-small campaign-warning">Default is <b>sxpgames</b>. It works, but a unique 12+ character password is strongly recommended.</div></div>`;
}
function bindPasswordToggle(){
  const input=$('#crewPassword'),btn=$('#togglePassword');if(!input||!btn)return;
  btn.onclick=()=>{const showing=input.type==='text';input.type=showing?'password':'text';btn.textContent=showing?'Show':'Hide';};
}
function openCreateCrewModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<section class="modal panel"><button class="btn ghost tiny modal-close">Close</button><div class="eyebrow">Campaign crew setup</div><h2>Create campaign crew</h2><form id="crewForm"><div class="field"><label>Crew name</label><input id="crewName" maxlength="80" required placeholder="Celeste Campaign Crew"></div><div class="campaign-small">This name appears on the shared campaign crew access page.</div>${passwordFieldMarkup()}<div class="actions"><button class="btn primary">Create campaign crew</button></div><div id="crewMessage" class="message"></div></form></section>`;
  document.body.appendChild(wrap);wrap.querySelector('.modal-close').onclick=()=>wrap.remove();bindPasswordToggle();
  $('#crewForm').onsubmit=async e=>{
    e.preventDefault();
    const name=$('#crewName').value.trim(),password=$('#crewPassword').value;
    if(!name)return msg($('#crewMessage'),'Enter a campaign crew name.','error');
    if(password.length<6)return msg($('#crewMessage'),'Firebase requires passwords of at least 6 characters.','error');
    if(password==='sxpgames'&&!confirm('sxpgames is the default password and is easy to guess. Create this crew with the default anyway?'))return;
    let bundle=null;
    try{
      const slug=await uniqueCrewSlug(name);
      const ref=doc(db,'ufnCampaignCrews',slug);
      msg($('#crewMessage'),'Creating secure campaign access…');
      bundle=await createCredentialAccount(password);
      const crewData={name,slug,authUid:bundle.user.uid,authEmail:bundle.email,active:true,passwordVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      await setDoc(ref,crewData);
      await setDoc(doc(db,'ufnCampaignDirectory',slug),{name,active:true,updatedAt:serverTimestamp()},{merge:true});
      await disposeCredentialAccount(bundle);
      wrap.remove();renderCampaignAdmin();
    }catch(err){
      if(bundle)await disposeCredentialAccount(bundle,{deleteCreated:true});
      msg($('#crewMessage'),friendlyAuthError(err),'error');
    }
  };
}

function openResetPasswordModal(c){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<section class="modal panel"><button class="btn ghost tiny modal-close">Close</button><div class="eyebrow">Campaign security</div><h2>Set a new password</h2><p class="sub">This rotates the campaign credential. Existing campaign sessions immediately lose Firestore access.</p><form id="resetForm">${passwordFieldMarkup('')}<div class="actions"><button class="btn danger">Rotate password</button></div><div id="resetMessage" class="message"></div></form></section>`;
  document.body.appendChild(wrap);wrap.querySelector('.modal-close').onclick=()=>wrap.remove();bindPasswordToggle();
  $('#resetForm').onsubmit=async e=>{
    e.preventDefault();const password=$('#crewPassword').value;if(password.length<6)return msg($('#resetMessage'),'Use at least 6 characters; 12+ is recommended.','error');
    let bundle=null;
    try{
      msg($('#resetMessage'),'Rotating campaign credential…');
      bundle=await createCredentialAccount(password);
      await updateDoc(doc(db,'ufnCampaignCrews',c.id),{authUid:bundle.user.uid,authEmail:bundle.email,passwordVersion:Number(c.passwordVersion||1)+1,passwordChangedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      await disposeCredentialAccount(bundle);
      wrap.remove();renderCampaignAdmin();
    }catch(err){
      if(bundle)await disposeCredentialAccount(bundle,{deleteCreated:true});
      msg($('#resetMessage'),friendlyAuthError(err),'error');
    }
  };
}
function friendlyAuthError(err){
  const code=err?.code||'';
  if(code.includes('weak-password'))return 'That password is too weak for Firebase Authentication.';
  if(code.includes('operation-not-allowed'))return 'Enable Email/Password in Firebase Authentication → Sign-in method first.';
  return err?.message||String(err);
}
