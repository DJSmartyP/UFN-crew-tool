const params = new URLSearchParams(location.search);

if (params.has('archive')) {
  await import('./archive-admin.js');
} else if (params.has('crew')) {
  await import('./campaign.js');
  await import('./campaign-polish.js');
} else if (params.has('campaigns')) {
  await import('./campaign-admin.js?v=20260912-stable1');
  await import('./campaign-admin-polish.js?v=20260912-directdep1');
  await import('./campaign-admin-create.js');
} else if (params.has('campaign')) {
  await import('./campaign-directory.js');
} else {
  await import('./app.js');
  await import('./admin-separation.js');
}

await import('./navigation-polish.js?v=20260912-directdep1');
await import('./short-crew-planner.js');

if (params.has('campaigns') && !document.querySelector('link[data-admin-direct-deployment-css]')) {
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./admin-direct-deployment.css?v=20260912-directdep1';
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
await import('./patch-lightbox.js?v=20260912-patchview1');
