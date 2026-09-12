# Campaign Admin Parity Rebuild

Replace:
- campaign-admin.js
- campaign-admin-polish.js
- admin-direct-deployment.css
- admin-separation.js
- campaign-polish.js
- router.js

This is a consolidation patch, not another visual layer.

MASTER ADMIN RULE
The master admin now gets organiser-level control over every campaign crew.

Campaign Crews page
- Removes the pointless accordion/dropdown behaviour.
- Each campaign crew is a normal section.
- Its deployment cards load immediately and remain visible.
- Every deployment card has direct Manage Deployment and Open Player Page access.
- Existing copy-link, archive/edit enhancements remain compatible.

Direct admin deployment page
- Add player
- Edit player
- Delete player
- Edit 1st/2nd/3rd preferences
- Edit Really Don't Want
- Set / clear station lock
- Rename player with duplicate-name protection
- Open / close player choices
- Edit deployment
- Open player page
- Archive deployment

Campaign organisers retain their existing equivalent player controls.

WATERMARK FIX
- Stops using the fragile CSS pseudo-watermark override.
- An uploaded campaign patch is inserted as a real faded watermark image layer inside the crew-plan card.
- The default UFN ::after watermark is completely suppressed whenever a campaign patch exists.
- No separate bottom-right patch is shown in crew plans.
- Works on player campaign plans, campaign organiser plans, and master-admin direct plans.
- Title-bar patch remains.

No Firebase/Auth/Firestore/rules changes are required.
