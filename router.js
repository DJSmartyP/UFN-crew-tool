const params = new URLSearchParams(location.search);

if (params.has('crew')) {
  await import('./campaign.js');
} else if (params.has('campaigns')) {
  await import('./campaign-admin.js');
} else {
  await import('./app.js');

  // Keep the existing UFN app untouched. On the master admin dashboard only,
  // add an entry point for campaign-crew administration.
  if (!params.has('m')) {
    const addCampaignButton = () => {
      const create = document.querySelector('#createDeployment');
      if (!create || document.querySelector('#campaignCrewsAdminLink')) return;
      const link = document.createElement('a');
      link.id = 'campaignCrewsAdminLink';
      link.className = 'btn ghost';
      link.href = `${location.pathname}?campaigns=1`;
      link.textContent = 'Campaign crews';
      create.parentElement?.insertBefore(link, create);
    };
    addCampaignButton();
    new MutationObserver(addCampaignButton).observe(document.body, { childList: true, subtree: true });
  }
}
