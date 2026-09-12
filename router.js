const params = new URLSearchParams(location.search);

if (params.has('archive')) {
  await import('./archive-admin.js');
} else if (params.has('crew')) {
  await import('./campaign.js');
  await import('./campaign-polish.js?v=20260912-patchplace1');
} else if (params.has('campaigns')) {
  await import('./campaign-admin.js?v=20260912-stable1');
  await import('./campaign-admin-polish.js?v=20260912-directrepair1');
  await import('./campaign-admin-create.js?v=20260912-directrepair1');
} else if (params.has('campaign')) {
  await import('./campaign-directory.js?v=20260912-patchplace1');
} else {
  await import('./app.js');
  await import('./admin-separation.js?v=20260912-playerfreeze1');
}

await import('./navigation-polish.js?v=20260912-directdep1');
await import('./short-crew-planner.js?v=20260912-usersave1');

if (params.has('campaigns') && !document.querySelector('link[data-admin-direct-deployment-css]')) {
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./admin-direct-deployment.css?v=20260912-directrepair1';
  link.dataset.adminDirectDeploymentCss='1';
  document.head.appendChild(link);
}

if (!document.querySelector('link[data-patch-lightbox-css]')) {
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./patch-lightbox.css?v=20260912-patchview1';
  link.dataset.patchLightboxCss='1';
  document.head.appendChild(link);
}
await import('./patch-lightbox.js?v=20260912-patchplace1');

if (params.has('m')) {
  if (!document.querySelector('link[data-player-save-polish-css]')) {
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./player-save-polish.css?v=20260912-usersave1';
    link.dataset.playerSavePolishCss='1';
    document.head.appendChild(link);
  }
  await import('./player-save-polish.js?v=20260912-usersave1');
}

if (!document.querySelector('link[data-campaign-card-alignment-css]')) {
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./campaign-card-alignment.css?v=20260912-patchplace1';
  link.dataset.campaignCardAlignmentCss='1';
  document.head.appendChild(link);
}
