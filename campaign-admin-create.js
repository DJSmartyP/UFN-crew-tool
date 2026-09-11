import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const crewSlug=String(params.get('adminCrew')||'').trim();
if(crewSlug){
  const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
  const auth=getAuth(app),db=getFirestore(app);

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify=s=>String(s||'').normalize('NFKD').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
  const localDate=()=>{
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const playerUrl=id=>`${location.origin}${location.pathname}?m=${encodeURIComponent(id)}`;

  function openCreateDeployment(){
    const wrap=document.createElement('div');
    wrap.className='modal-backdrop';
    wrap.innerHTML=`<section class="modal panel">
      <button class="btn ghost tiny modal-close" type="button">Close</button>
      <div class="eyebrow">Admin campaign hub</div>
      <h2>Create campaign deployment</h2>
      <form id="adminCreateCampaignDeployment">
        <div class="field"><label>Deployment name</label><input id="adminNewDepTitle" maxlength="80" required autofocus></div>
        <div class="field"><label>Date</label><input id="adminNewDepDate" type="date" required value="${localDate()}"></div>
        <div class="field"><label>Custom player link name</label><input id="adminNewDepSlug" maxlength="60" required placeholder="${esc(crewSlug)}-mission"></div>
        <div class="campaign-small">Player link: <span id="adminNewDepPreview">${esc(playerUrl('your-link'))}</span></div>
        <div class="campaign-small campaign-warning"><b>Campaign Crew Deployment</b> · one crew · maximum 6 players.</div>
        <div class="actions"><button class="btn primary">Create deployment</button><button class="btn ghost modal-cancel" type="button">Cancel</button></div>
        <div id="adminCreateDepMessage" class="message"></div>
      </form>
    </section>`;
    document.body.appendChild(wrap);

    const title=wrap.querySelector('#adminNewDepTitle');
    const slug=wrap.querySelector('#adminNewDepSlug');
    const preview=wrap.querySelector('#adminNewDepPreview');
    let slugTouched=false;
    const updatePreview=()=>{
      slug.value=slugify(slug.value);
      preview.textContent=playerUrl(slug.value||'your-link');
    };
    title.addEventListener('input',()=>{
      if(!slugTouched){
        slug.value=slugify(`${crewSlug}-${title.value}`);
        updatePreview();
      }
    });
    slug.addEventListener('input',()=>{slugTouched=true;updatePreview();});
    wrap.querySelector('.modal-close').onclick=()=>wrap.remove();
    wrap.querySelector('.modal-cancel').onclick=()=>wrap.remove();

    wrap.querySelector('#adminCreateCampaignDeployment').onsubmit=async e=>{
      e.preventDefault();
      const message=wrap.querySelector('#adminCreateDepMessage');
      const id=slugify(slug.value);
      if(id.length<3){message.textContent='Use at least 3 characters for the player link.';return;}
      try{
        message.textContent='Creating deployment…';
        const ref=doc(db,'ufnDeployments',id);
        if((await getDoc(ref)).exists())throw new Error('That player link is already in use. Choose another.');
        await setDoc(ref,{
          title:title.value.trim(),
          date:wrap.querySelector('#adminNewDepDate').value,
          shipCount:1,
          ufnShipName:'Campaign Crew',
          ghostShipName:'',
          campaignCrew:crewSlug,
          closed:false,
          archived:false,
          overrides:{},
          responseCount:0,
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp()
        });
        message.textContent='Deployment created ✓';
        setTimeout(()=>location.reload(),250);
      }catch(err){
        message.textContent=`Could not create deployment: ${err.message}`;
      }
    };
  }

  function addButton(){
    const actions=document.querySelector('.campaign-dashboard-actions');
    if(!actions||document.querySelector('#adminCreateCampaignDeploymentButton'))return;
    const btn=document.createElement('button');
    btn.id='adminCreateCampaignDeploymentButton';
    btn.className='btn primary';
    btn.textContent='Create deployment';
    btn.onclick=openCreateDeployment;
    actions.prepend(btn);
  }

  onAuthStateChanged(auth,user=>{
    if(!user||user.uid!==ADMIN_UID)return;
    addButton();
    new MutationObserver(addButton).observe(document.body,{childList:true,subtree:true});
  });
}
