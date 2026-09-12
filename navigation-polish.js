import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const params=new URLSearchParams(location.search);
const topActions=document.querySelector('#topActions');
const path=location.pathname;

const isPlayer=params.has('m');
const isCampaignHub=params.has('crew');
const isCampaignDirectory=params.has('campaign')&&!params.has('campaigns');
const isCampaignAdmin=params.has('campaigns');
const isArchive=params.has('archive');
const isRootAdmin=!isPlayer&&!isCampaignHub&&!isCampaignDirectory&&!isCampaignAdmin&&!isArchive;
const adminCrew=params.get('adminCrew')||'';

const ICONS={
  deployments:'./assets/nav-deployments.png',
  campaigns:'./assets/nav-campaign-crews.png',
  access:'./assets/nav-crew-access.png',
  archive:'./assets/nav-archive.png'
};

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function navTab({label,href,icon,active=false,current=false}){
  return `<a class="e-nav-tab${active?' is-active':''}" href="${href}"${current?' aria-current="page"':''}>
    <img class="e-nav-icon" src="${icon}" alt="">
    <span>${esc(label)}</span>
  </a>`;
}

function backLink({label,href='',clickTarget=''}) {
  if(clickTarget){
    return `<button class="e-context-back" type="button" data-nav-click="${esc(clickTarget)}">
      <span class="e-back-chevron">‹</span><span>${esc(label)}</span>
    </button>`;
  }
  return `<a class="e-context-back" href="${href}">
    <span class="e-back-chevron">‹</span><span>${esc(label)}</span>
  </a>`;
}

function adminPrimary(active){
  return `<div class="e-nav-primary">
    <nav class="e-nav-tabs" aria-label="UFN administration">
      ${navTab({label:'Deployments',href:path,icon:ICONS.deployments,active:active==='deployments',current:active==='deployments'})}
      ${navTab({label:'Campaign crews',href:`${path}?campaigns=1`,icon:ICONS.campaigns,active:active==='campaigns',current:active==='campaigns'})}
      ${navTab({label:'Crew access',href:`${path}?campaign=1`,icon:ICONS.access})}
      ${navTab({label:'Archive',href:`${path}?archive=1`,icon:ICONS.archive,active:active==='archive',current:active==='archive'})}
    </nav>
    <div class="e-nav-account">
      <span class="e-nav-status">UFN administrator</span>
      <button id="elegantSignOut" class="e-nav-signout" type="button">Sign out</button>
    </div>
  </div>`;
}

function adminContext(){
  if(adminCrew){
    const crewName=document.querySelector('.admin-crew-heading h1')?.textContent?.trim()
      || document.querySelector('.campaign-dashboard-head h1')?.textContent?.trim()
      || 'Campaign crew';
    return `<div class="e-nav-context">
      ${backLink({label:'Back to campaign crews',href:`${path}?campaigns=1`})}
      <div class="e-context-current">
        <img src="${ICONS.campaigns}" alt="">
        <span><small>Admin crew hub</small><b>${esc(crewName)}</b></span>
      </div>
    </div>`;
  }

  if(isRootAdmin&&document.querySelector('#backDash')){
    const title=document.querySelector('.deployment-visual-copy b')?.textContent?.trim()||'Deployment';
    return `<div class="e-nav-context">
      ${backLink({label:'Back to deployments',clickTarget:'#backDash'})}
      <div class="e-context-current">
        <img src="${ICONS.deployments}" alt="">
        <span><small>Deployment management</small><b>${esc(title)}</b></span>
      </div>
    </div>`;
  }

  return '';
}

function renderAdminNav(active){
  if(!topActions)return;
  topActions.classList.add('e-nav-host');
  const markup=`<div class="e-nav-shell">${adminPrimary(active)}${adminContext()}</div>`;
  if(topActions.dataset.elegantMarkup!==markup || !topActions.querySelector(':scope > .e-nav-shell')){
    topActions.innerHTML=markup;
    topActions.dataset.elegantMarkup=markup;
  }
  document.querySelector('#elegantSignOut')?.addEventListener('click',async()=>{
    try{
      const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
      await signOut(getAuth(app));
    }catch{}
  },{once:true});
  wireContextClicks();
}

function currentCrewName(){
  return document.querySelector('.campaign-dashboard-head h1')?.textContent?.trim()
    || document.querySelector('.campaign-login-card h1')?.textContent?.trim()
    || topActions?.querySelector('.pill')?.textContent?.trim()
    || 'Campaign crew';
}

function captureCampaignControls(){
  if(!topActions)return {};
  const settings=topActions.querySelector('#crewSettings');
  const pill=topActions.querySelector('.pill');
  const accessLink=topActions.querySelector('a[href*="?campaign=1"]');
  return {settings,pill,accessLink};
}

function renderCampaignHubNav(){
  if(!topActions)return;

  const controls=captureCampaignControls();
  if(controls.settings)topActions._crewSettingsButton=controls.settings;

  const crewName=currentCrewName();
  const inManage=Boolean(document.querySelector('#backDash'));
  const inLogin=Boolean(document.querySelector('.campaign-login-shell'));
  const settingsButton=topActions._crewSettingsButton;

  const primary=`<div class="e-nav-primary e-nav-public">
    <nav class="e-nav-tabs" aria-label="Campaign navigation">
      ${navTab({label:'All campaign crews',href:`${path}?campaign=1`,icon:ICONS.campaigns})}
      <span class="e-nav-tab is-active is-static" aria-current="page">
        <img class="e-nav-icon" src="${ICONS.access}" alt="">
        <span>${esc(crewName)}</span>
      </span>
    </nav>
    <div class="e-nav-account" id="campaignNavUtilities"></div>
  </div>`;

  let context='';
  if(inManage){
    const title=document.querySelector('.deployment-visual-copy b')?.textContent?.trim()||'Deployment';
    context=`<div class="e-nav-context">
      ${backLink({label:'Back to crew hub',clickTarget:'#backDash'})}
      <div class="e-context-current">
        <img src="${ICONS.deployments}" alt="">
        <span><small>Campaign deployment</small><b>${esc(title)}</b></span>
      </div>
    </div>`;
  }else if(inLogin){
    context=`<div class="e-nav-context">
      ${backLink({label:'Back to all campaign crews',href:`${path}?campaign=1`})}
      <div class="e-context-current">
        <img src="${ICONS.access}" alt="">
        <span><small>Campaign access</small><b>${esc(crewName)}</b></span>
      </div>
    </div>`;
  }

  const markup=`<div class="e-nav-shell">${primary}${context}</div>`;
  if(topActions.dataset.elegantMarkup!==markup || !topActions.querySelector(':scope > .e-nav-shell')){
    topActions.innerHTML=markup;
    topActions.dataset.elegantMarkup=markup;
  }

  const utility=document.querySelector('#campaignNavUtilities');
  if(utility&&settingsButton&&!utility.contains(settingsButton)){
    settingsButton.className='e-nav-utility';
    settingsButton.textContent='Campaign settings';
    utility.appendChild(settingsButton);
  }

  wireContextClicks();
}

function renderDirectoryNav(){
  if(!topActions)return;
  topActions.classList.add('e-nav-host');
  const markup=`<div class="e-nav-shell">
    <div class="e-nav-primary e-nav-public">
      <nav class="e-nav-tabs" aria-label="Campaign access">
        <span class="e-nav-tab is-active is-static" aria-current="page">
          <img class="e-nav-icon" src="${ICONS.campaigns}" alt="">
          <span>Campaign crews</span>
        </span>
      </nav>
    </div>
  </div>`;
  if(topActions.dataset.elegantMarkup!==markup || !topActions.querySelector(':scope > .e-nav-shell')){
    topActions.innerHTML=markup;
    topActions.dataset.elegantMarkup=markup;
  }
}

function capturePlayerContext(){
  if(!topActions)return;
  const crewLink=topActions.querySelector('a[href*="?crew="]');
  const pill=topActions.querySelector('.pill');
  if(crewLink?.href)topActions.dataset.playerCrewHref=crewLink.href;
  if(pill?.textContent?.trim())topActions.dataset.playerCrewName=pill.textContent.trim();
}

function renderPlayerNav(){
  if(!topActions)return;
  capturePlayerContext();
  topActions.classList.add('e-nav-host');

  const crewHref=topActions.dataset.playerCrewHref||'';
  const crewName=topActions.dataset.playerCrewName||'';
  const title=document.querySelector('.deployment-visual-copy b')?.textContent?.trim()||'Player deployment';

  const primary=`<div class="e-nav-primary e-nav-public">
    <nav class="e-nav-tabs" aria-label="Player deployment">
      <span class="e-nav-tab is-active is-static" aria-current="page">
        <img class="e-nav-icon" src="${ICONS.deployments}" alt="">
        <span>Player deployment</span>
      </span>
    </nav>
    ${crewName?`<div class="e-nav-account"><span class="e-nav-status">${esc(crewName)}</span></div>`:''}
  </div>`;

  const context=crewHref?`<div class="e-nav-context">
    ${backLink({label:'Back to crew hub',href:crewHref})}
    <div class="e-context-current">
      <img src="${ICONS.deployments}" alt="">
      <span><small>Registration</small><b>${esc(title)}</b></span>
    </div>
  </div>`:'';

  const markup=`<div class="e-nav-shell">${primary}${context}</div>`;
  if(topActions.dataset.elegantMarkup!==markup || !topActions.querySelector(':scope > .e-nav-shell')){
    topActions.innerHTML=markup;
    topActions.dataset.elegantMarkup=markup;
  }
}

function wireContextClicks(){
  document.querySelectorAll('[data-nav-click]').forEach(btn=>{
    if(btn.dataset.navWired==='1')return;
    btn.dataset.navWired='1';
    btn.addEventListener('click',()=>{
      document.querySelector(btn.dataset.navClick)?.click();
    });
  });
}

function styleInPageBackButtons(){
  document.querySelectorAll('#backDash').forEach(btn=>{
    btn.classList.add('e-inpage-back');
  });
  document.querySelectorAll('.modal-close').forEach(btn=>{
    if(!btn.getAttribute('aria-label'))btn.setAttribute('aria-label','Close dialog');
  });
}

function applyPublic(){
  if(isCampaignDirectory)renderDirectoryNav();
  else if(isCampaignHub)renderCampaignHubNav();
  else if(isPlayer)renderPlayerNav();
  styleInPageBackButtons();
}

if(isRootAdmin||isCampaignAdmin||isArchive){
  const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig);
  const auth=getAuth(app);
  onAuthStateChanged(auth,user=>{
    if(!user||user.uid!==ADMIN_UID)return;
    const active=isRootAdmin?'deployments':isArchive?'archive':'campaigns';
    const apply=()=>renderAdminNav(active);
    apply();
    new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  });
}else{
  applyPublic();
  new MutationObserver(applyPublic).observe(document.body,{childList:true,subtree:true});
}
