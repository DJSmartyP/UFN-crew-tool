# UFN elegant navigation system update

Replace:
- navigation-polish.js
- campaign.css

Add / replace:
- assets/nav-deployments.png
- assets/nav-campaign-crews.png
- assets/nav-crew-access.png
- assets/nav-archive.png

No Firebase, Auth, Firestore or rules changes are required.

Navigation coverage:
- Main admin dashboard: full icon navigation rail.
- Campaign crew administration: full icon navigation rail.
- Admin campaign crew hub: full rail + 'Back to campaign crews' contextual row.
- Archive: full icon navigation rail.
- Standalone deployment management: full rail + 'Back to deployments' contextual row.
- Campaign crew directory: clean Campaign Crews navigation state.
- Campaign password/access screen: 'Back to all campaign crews'.
- Campaign crew hub: All Campaign Crews + current crew + Campaign Settings.
- Campaign deployment management: contextual 'Back to crew hub'.
- Campaign player deployment: contextual 'Back to crew hub' where a campaign is known.
- Standalone player deployment: clean current-page navigation without inventing a destination.

The four PNG icons have been resized to 192x192 for fast loading while remaining sharp in the UI.
