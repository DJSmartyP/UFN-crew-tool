const params = new URLSearchParams(location.search);

if (params.has('archive')) {
  await import('./archive-admin.js');
} else if (params.has('crew')) {
  await import('./campaign.js');
  await import('./campaign-polish.js');
} else if (params.has('campaigns')) {
  await import('./campaign-admin.js');
  await import('./campaign-admin-polish.js');
} else if (params.has('campaign')) {
  await import('./campaign-directory.js');
} else {
  await import('./app.js');
  await import('./admin-separation.js');

  if (!params.has('m')) {
    const addAdminButtons = () => {
      const create = document.querySelector('#createDeployment');
      if (!create) return;
      const parent = create.parentElement;
      if (!parent) return;

      if (!document.querySelector('#campaignCrewsAdminLink')) {
        const link = document.createElement('a');
        link.id = 'campaignCrewsAdminLink';
        link.className = 'btn ghost';
        link.href = `${location.pathname}?campaigns=1`;
        link.textContent = 'Campaign crews';
        parent.insertBefore(link, create);
      }
      if (!document.querySelector('#campaignCrewAccessLink')) {
        const link = document.createElement('a');
        link.id = 'campaignCrewAccessLink';
        link.className = 'btn ghost';
        link.href = `${location.pathname}?campaign=1`;
        link.textContent = 'Crew access page';
        parent.insertBefore(link, create);
      }
      if (!document.querySelector('#deploymentArchiveLink')) {
        const link = document.createElement('a');
        link.id = 'deploymentArchiveLink';
        link.className = 'btn ghost';
        link.href = `${location.pathname}?archive=1`;
        link.textContent = 'Archive';
        parent.insertBefore(link, create);
      }
    };
    addAdminButtons();
    new MutationObserver(addAdminButtons).observe(document.body, { childList: true, subtree: true });
  }
}
