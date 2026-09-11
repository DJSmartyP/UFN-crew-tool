const params = new URLSearchParams(location.search);

if (params.has('crew')) {
  await import('./campaign.js');
} else if (params.has('campaigns')) {
  await import('./campaign-admin.js');
} else if (params.has('campaign')) {
  await import('./campaign-directory.js');
} else {
  await import('./app.js');
  await import('./admin-separation.js');

  if (!params.has('m')) {
    const addCampaignButtons = () => {
      const create = document.querySelector('#createDeployment');
      if (!create) return;
      if (!document.querySelector('#campaignCrewsAdminLink')) {
        const link = document.createElement('a');
        link.id = 'campaignCrewsAdminLink';
        link.className = 'btn ghost';
        link.href = `${location.pathname}?campaigns=1`;
        link.textContent = 'Campaign crews';
        create.parentElement?.insertBefore(link, create);
      }
      if (!document.querySelector('#campaignCrewAccessLink')) {
        const link = document.createElement('a');
        link.id = 'campaignCrewAccessLink';
        link.className = 'btn ghost';
        link.href = `${location.pathname}?campaign=1`;
        link.textContent = 'Crew access page';
        create.parentElement?.insertBefore(link, create);
      }
    };
    addCampaignButtons();
    new MutationObserver(addCampaignButtons).observe(document.body, { childList: true, subtree: true });
  }
}
