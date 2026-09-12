const PATCH_SELECTORS=[
  '.campaign-hub-patch img',
  '.campaign-dashboard-head .admin-crew-patch',
  '.campaign-login-card .campaign-directory-patch',
  '.campaign-crew-plan-patch'
];

function findWatermarkElements(){
  const mark=document.querySelector('.ufn-mark');
  const img=mark?.querySelector('img');
  return {mark,img};
}

function pickCampaignPatch(){
  for(const sel of PATCH_SELECTORS){
    const img=document.querySelector(sel);
    if(img?.getAttribute('src')) return img;
  }
  return null;
}

function crewNameFromPatch(patch){
  const candidates=[
    patch?.closest('.campaign-dashboard-head')?.querySelector('h1,h2')?.textContent,
    patch?.closest('.campaign-login-card')?.querySelector('h1,h2')?.textContent,
    document.querySelector('.campaign-dashboard-head h1')?.textContent,
    document.querySelector('.campaign-login-card h1')?.textContent,
    document.querySelector('.compact-player-head .campaign-player-marker .pill:last-child')?.textContent
  ].map(x=>String(x||'').trim()).filter(Boolean);

  if(candidates.length) return candidates[0];

  const alt=String(patch?.getAttribute('alt')||'').trim();
  if(alt) return alt.replace(/\s+patch$/i,'').trim();

  return 'Campaign crew';
}

function applyCampaignWatermark(){
  const {mark,img}=findWatermarkElements();
  if(!mark||!img) return;

  if(!img.dataset.defaultSrc) img.dataset.defaultSrc=img.getAttribute('src')||'';
  if(!img.dataset.defaultAlt) img.dataset.defaultAlt=img.getAttribute('alt')||'United Federated Navy';

  const patch=pickCampaignPatch();
  if(patch){
    const src=patch.getAttribute('src')||'';
    const name=crewNameFromPatch(patch);
    if(src && img.getAttribute('src')!==src) img.setAttribute('src',src);
    const alt=`${name} patch`;
    if(img.getAttribute('alt')!==alt) img.setAttribute('alt',alt);
    mark.classList.add('campaign-watermark-active');
  }else{
    if(img.getAttribute('src')!==img.dataset.defaultSrc) img.setAttribute('src',img.dataset.defaultSrc);
    if(img.getAttribute('alt')!==img.dataset.defaultAlt) img.setAttribute('alt',img.dataset.defaultAlt);
    mark.classList.remove('campaign-watermark-active');
  }
}

let pending=false;
function scheduleApply(){
  if(pending) return;
  pending=true;
  requestAnimationFrame(()=>{
    pending=false;
    applyCampaignWatermark();
  });
}

scheduleApply();

const main=document.querySelector('#main');
const topActions=document.querySelector('#topActions');
if(main) new MutationObserver(scheduleApply).observe(main,{childList:true,subtree:true});
if(topActions) new MutationObserver(scheduleApply).observe(topActions,{childList:true,subtree:true});
