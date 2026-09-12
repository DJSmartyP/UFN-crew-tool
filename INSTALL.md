# Admin Crew Access navigation fix

Replace:
- navigation-polish.js
- router.js

No CSS, asset, Firebase, Firestore or rules changes are required.

Fix:
- When the signed-in UFN administrator opens Crew Access, the full admin navigation remains visible.
- Crew Access is highlighted as the current admin section.
- Public/campaign users opening the same Crew Access page still see the simple public navigation.
- The router cache-bust has been advanced so GitHub Pages/browser caching does not keep the previous nav module.
