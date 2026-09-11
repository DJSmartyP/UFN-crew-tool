import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps, deleteApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  createUserWithEmailAndPassword, deleteUser
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
  serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = s => document.querySelector(s);
const main = $('#main');
const topActions = $('#topActions');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify = s => String(s || '').normalize('NFKD').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;

function msg(el,text,type=''){ if(!el)return; el.textContent=text||''; el.className=`message${type?` ${type}`:''}`; }
function crewUrl(slug){ return `${location.origin}${location.pathname}?crew=${encodeURIComponent(slug)}`; }
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
  renderTop();
  renderCampaignAdmin();
});

function renderTop(){
  topActions.innerHTML = `<div class="campaign-admin-nav"><a class="btn ghost tiny" href="${location.pathname}">← Deployments</a><span class="pill ufn">UFN administrator</span><button id="logout" class="btn ghost tiny">Sign out</button></div>`;
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
  main.innerHTML=`<div class="page-head campaign-dashboard-head"><div><div class="eyebrow">UFN administrator</div><h1>Campaign crews</h1><p class="sub">Create self-contained campaign planners with a custom link and shared password.</p></div><div class="campaign-dashboard-actions"><button id="newCrew" class="btn primary">Create campaign crew</button></div></div><div id="crewList" class="grid cards"><section class="loading-card"><div class="scanner"></div><p>Loading campaign crews…</p></section></div>`;
  $('#newCrew').onclick=openCreateCrewModal;
  try{
    const snap=await getDocs(query(collection(db,'ufnCampaignCrews'),orderBy('name')));
    const crews=snap.docs.map(d=>({id:d.id,...d.data()}));
    $('#crewList').innerHTML=crews.length?crews.map(renderCrewCard).join(''):`<section class="empty-state"><h2>No campaign crews yet</h2><p>Create the first campaign crew system.</p></section>`;
    crews.forEach(bindCrewCard);
  }catch(e){
    $('#crewList').innerHTML=`<section class="empty-state"><h2>Could not load campaign crews</h2><p>${esc(e.message)}</p></section>`;
  }
}
function renderCrewCard(c){
  return `<section class="panel campaign-card" data-crew-card="${esc(c.id)}"><div class="campaign-card-top"><div><div class="eyebrow">Campaign crew</div><h2>${esc(c.name||c.id)}</h2><div class="campaign-slug">?crew=${esc(c.id)}</div></div><span class="pill ${c.active===false?'closed':'open'}">${c.active===false?'Disabled':'Active'}</span></div><div class="campaign-status-row"><span class="pill">Password version ${Number(c.passwordVersion||1)}</span></div><div class="share-box"><input readonly value="${esc(crewUrl(c.id))}"><button class="btn ghost tiny" data-copy-crew="${esc(c.id)}">Copy link</button></div><div class="actions"><a class="btn primary" href="${esc(crewUrl(c.id))}">Open</a><button class="btn ghost" data-reset-password="${esc(c.id)}">Set new password</button><button class="btn ${c.active===false?'success':'danger'}" data-toggle-crew="${esc(c.id)}">${c.active===false?'Enable':'Disable'}</button></div></section>`;
}
function bindCrewCard(c){
  document.querySelector(`[data-copy-crew="${CSS.escape(c.id)}"]`)?.addEventListener('click',()=>navigator.clipboard.writeText(crewUrl(c.id)));
  document.querySelector(`[data-reset-password="${CSS.escape(c.id)}"]`)?.addEventListener('click',()=>openResetPasswordModal(c));
  document.querySelector(`[data-toggle-crew="${CSS.escape(c.id)}"]`)?.addEventListener('click',async()=>{
    const next=c.active===false;
    if(!confirm(`${next?'Enable':'Disable'} ${c.name}?`))return;
    await updateDoc(doc(db,'ufnCampaignCrews',c.id),{active:next,updatedAt:serverTimestamp()});
    renderCampaignAdmin();
  });
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
  wrap.innerHTML=`<section class="modal panel"><button class="btn ghost tiny modal-close">Close</button><div class="eyebrow">Campaign crew setup</div><h2>Create campaign crew</h2><form id="crewForm"><div class="field"><label>Crew name</label><input id="crewName" maxlength="80" required placeholder="Celeste Campaign Crew"></div><div class="field"><label>Custom link name</label><input id="crewSlug" maxlength="50" required placeholder="celeste"><div class="campaign-small">Link: <span id="slugPreview">${esc(location.origin+location.pathname)}?crew=celeste</span></div></div>${passwordFieldMarkup()}<div class="actions"><button class="btn primary">Create campaign crew</button></div><div id="crewMessage" class="message"></div></form></section>`;
  document.body.appendChild(wrap);wrap.querySelector('.modal-close').onclick=()=>wrap.remove();bindPasswordToggle();
  $('#crewName').addEventListener('input',()=>{if(!$('#crewSlug').dataset.touched){$('#crewSlug').value=slugify($('#crewName').value);updatePreview();}});
  $('#crewSlug').addEventListener('input',()=>{$('#crewSlug').dataset.touched='1';$('#crewSlug').value=slugify($('#crewSlug').value);updatePreview();});
  function updatePreview(){ $('#slugPreview').textContent=crewUrl(slugify($('#crewSlug').value)||'your-crew'); }
  $('#crewForm').onsubmit=async e=>{
    e.preventDefault();
    const name=$('#crewName').value.trim(),slug=slugify($('#crewSlug').value),password=$('#crewPassword').value;
    if(!slug)return msg($('#crewMessage'),'Enter a valid custom link name.','error');
    if(password.length<6)return msg($('#crewMessage'),'Firebase requires passwords of at least 6 characters.','error');
    if(password==='sxpgames'&&!confirm('sxpgames is the default password and is easy to guess. Create this crew with the default anyway?'))return;
    let bundle=null;
    try{
      const ref=doc(db,'ufnCampaignCrews',slug);
      if((await getDoc(ref)).exists())throw new Error('That custom link name is already in use.');
      msg($('#crewMessage'),'Creating secure campaign access…');
      bundle=await createCredentialAccount(password);
      await setDoc(ref,{name,slug,authUid:bundle.user.uid,authEmail:bundle.email,active:true,passwordVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
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
