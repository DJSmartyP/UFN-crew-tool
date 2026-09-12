const PATCH_SELECTORS=[
  '.campaign-hub-patch img',
  '.campaign-directory-patch',
  '.admin-crew-patch',
  '.campaign-patch-banner',
  '.campaign-player-patch',
  '.campaign-card-patch',
  '.campaign-patch-preview img',
  '.campaign-crew-plan-patch'
];

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function isPatchImage(el){
  return el instanceof HTMLImageElement &&
    PATCH_SELECTORS.some(sel=>el.matches(sel));
}

function crewNameFor(img){
  const candidates=[
    img.closest('.campaign-dashboard-head')?.querySelector('h1,h2')?.textContent,
    img.closest('.campaign-directory-card')?.querySelector('h2,h3')?.textContent,
    img.closest('.campaign-crew-accordion')?.querySelector('h2,h3')?.textContent,
    img.closest('.mission-card')?.querySelector('.sub')?.textContent,
    img.closest('.panel')?.querySelector('h1,h2,h3')?.textContent,
    document.querySelector('.campaign-dashboard-head h1')?.textContent,
    document.querySelector('.campaign-login-card h1')?.textContent
  ].map(x=>String(x||'').trim()).filter(Boolean);

  if(candidates.length)return candidates[0];

  const alt=String(img.alt||'').trim();
  if(alt)return alt.replace(/\s+patch$/i,'').trim();

  return 'Campaign crew';
}

function closePatchLightbox(){
  document.querySelector('.patch-lightbox-backdrop')?.remove();
  document.body.classList.remove('patch-lightbox-open');
}

function openPatchLightbox(img){
  if(!img?.src)return;

  closePatchLightbox();

  const name=crewNameFor(img);
  const wrap=document.createElement('div');
  wrap.className='patch-lightbox-backdrop';
  wrap.setAttribute('role','dialog');
  wrap.setAttribute('aria-modal','true');
  wrap.setAttribute('aria-label',`${name} patch`);

  wrap.innerHTML=`
    <section class="patch-lightbox-card">
      <button class="patch-lightbox-close" type="button" aria-label="Close patch view">×</button>
      <div class="patch-lightbox-art">
        <img src="${esc(img.src)}" alt="${esc(name)} patch">
      </div>
      <div class="patch-lightbox-copy">
        <div class="patch-lightbox-eyebrow">Campaign crew</div>
        <h2>${esc(name)}</h2>
      </div>
    </section>`;

  document.body.appendChild(wrap);
  document.body.classList.add('patch-lightbox-open');

  wrap.querySelector('.patch-lightbox-close')?.addEventListener('click',closePatchLightbox);
  wrap.addEventListener('click',e=>{
    if(e.target===wrap)closePatchLightbox();
  });
  wrap.querySelector('.patch-lightbox-close')?.focus();
}

document.addEventListener('click',e=>{
  const img=e.target.closest('img');
  if(!isPatchImage(img))return;
  e.preventDefault();
  e.stopPropagation();
  openPatchLightbox(img);
},true);

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.querySelector('.patch-lightbox-backdrop')){
    closePatchLightbox();
  }
});

// Make clickable patch images discoverable without rewriting their surrounding UI.
function markPatches(){
  PATCH_SELECTORS.forEach(sel=>{
    document.querySelectorAll(sel).forEach(img=>{
      img.classList.add('patch-expandable');
      img.setAttribute('tabindex','0');
      img.setAttribute('role','button');
      img.setAttribute('aria-label',`View ${crewNameFor(img)} patch`);
    });
  });
}

document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&isPatchImage(e.target)){
    e.preventDefault();
    openPatchLightbox(e.target);
  }
});

let pending=false;
const scheduleMark=()=>{
  if(pending)return;
  pending=true;
  requestAnimationFrame(()=>{
    pending=false;
    markPatches();
  });
};

markPatches();

const main=document.querySelector('#main');
const topActions=document.querySelector('#topActions');
if(main)new MutationObserver(scheduleMark).observe(main,{childList:true,subtree:true});
if(topActions)new MutationObserver(scheduleMark).observe(topActions,{childList:true,subtree:true});
