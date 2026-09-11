const params = new URLSearchParams(location.search);

if (params.has('archive')) {
  await import('./archive-admin.js');
} else if (params.has('crew')) {
  await import('./campaign.js');
  await import('./campaign-polish.js');
} else if (params.has('campaigns')) {
  await import('./campaign-admin.js');
  await import('./campaign-admin-polish.js');
  await import('./campaign-admin-create.js');
} else if (params.has('campaign')) {
  await import('./campaign-directory.js');
} else {
  await import('./app.js');
  await import('./admin-separation.js');
}

await import('./navigation-polish.js');
