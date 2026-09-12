const params=new URLSearchParams(location.search);
if(params.has('m')){
  const main=document.querySelector('#main');
  let pendingName='';
  let saveStartedAt=0;
  let lastForm=null;

  function ensureSavedNotice(){
    const key=`ufnPlayerSavedNotice:${params.get('m')}`;
    const text=sessionStorage.getItem(key)||'';
    if(!text)return;
    const form=document.querySelector('#playerForm');
    if(!form)return;
    let notice=form.querySelector('.player-save-persistent');
    if(!notice){
      notice=document.createElement('div');
      notice.className='message ok player-save-persistent';
      const capacity=form.querySelector('.capacity-note');
      if(capacity)form.insertBefore(notice,capacity);
      else form.appendChild(notice);
    }
    if(notice.textContent!==text)notice.textContent=text;
  }

  function wireForm(){
    const form=document.querySelector('#playerForm');
    if(!form||form===lastForm){
      ensureSavedNotice();
      return;
    }
    lastForm=form;

    form.addEventListener('submit',()=>{
      const button=form.querySelector('button[type="submit"],button:not([type])');
      pendingName=form.querySelector('#pName')?.value?.trim()||'';
      saveStartedAt=Date.now();

      if(button){
        button.disabled=true;
        button.dataset.originalText=button.textContent||'Save choices';
        button.textContent='Saving…';
      }

      sessionStorage.removeItem(`ufnPlayerSavedNotice:${params.get('m')}`);

      // app.js will handle the actual transaction and error message.
      // Re-enable if it rejects and the form remains on screen.
      setTimeout(()=>{
        if(!form.isConnected)return;
        const message=form.querySelector('#playerMessage');
        const failed=message?.classList.contains('error')||message?.classList.contains('warn');
        if(failed&&button){
          button.disabled=false;
          button.textContent=button.dataset.originalText||'Save choices';
        }
      },900);
    },true);

    ensureSavedNotice();
  }

  function detectSuccessfulSave(){
    if(!saveStartedAt||Date.now()-saveStartedAt>10000)return;

    // app.js makes Name / callsign readonly once this browser identity has
    // a saved player record. Treat that Firestore-driven rerender as success.
    const name=document.querySelector('#pName');
    if(name?.readOnly && (!pendingName || name.value.trim()===pendingName)){
      const key=`ufnPlayerSavedNotice:${params.get('m')}`;
      sessionStorage.setItem(
        key,
        'Choices saved ✓ You can update them again while choices remain open.'
      );
      saveStartedAt=0;
      pendingName='';
      ensureSavedNotice();
    }
  }

  let pending=false;
  function apply(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      wireForm();
      detectSuccessfulSave();
    });
  }

  apply();
  if(main)new MutationObserver(apply).observe(main,{childList:true,subtree:true});
}
