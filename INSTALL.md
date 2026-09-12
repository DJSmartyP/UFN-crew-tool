# UFN admin crew hub stability fix

Replace:
- campaign-admin.js
- campaign-admin-polish.js
- navigation-polish.js
- router.js

No CSS, PNG assets, Firebase, Auth, Firestore data or rules changes are required.

What was wrong:
1. campaign-admin.js wrote its own top navigation even on ?campaigns=1&adminCrew=...
2. campaign-admin-polish.js then wrote a second admin-crew header.
3. navigation-polish.js then replaced that with the unified bar.
4. Multiple broad MutationObservers watched the entire document while these modules repeatedly changed UI.

This update gives each part one owner:
- campaign-admin.js owns the Campaign Crews list page only.
- campaign-admin-polish.js owns the admin crew hub CONTENT only.
- navigation-polish.js exclusively owns #topActions / the navigation bar.
- Navigation observation is now scoped to #main and #topActions and throttled to one update per animation frame instead of watching the entire body.

Also retained:
- Full admin nav on Crew Access for the signed-in master admin.
- Crew Access highlighted while there.
- Back to Campaign Crews on an admin crew hub.
- Back to Deployments / Back to Crew Hub contextual navigation where relevant.

The router includes a fresh cache-bust for all three affected modules.
