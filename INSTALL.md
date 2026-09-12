# Direct admin deployment page repair

Replace:
- campaign-admin-polish.js
- campaign-admin-create.js
- admin-direct-deployment.css
- router.js

What this fixes:
- Removes the stray 'Create deployment' button from an individual deployment page.
- Keeps Create Deployment only on the crew hub.
- Rebuilds the direct admin deployment page as a real management screen.
- Restores a visible six-station crew plan: Captain, Helm, Weapons, Engineering, Science, Relay.
- Applies the 4/5-player combined-station rules in the direct admin view.
- Captain's additional station honours their next preference where practical.
- Replaces raw __FLEX__ values with 'No preference / fill a gap'.
- Keeps Edit Details, Open Player Page, Copy Link and Archive.
- Saving deployment edits returns to the deployment page rather than kicking admin back to the crew hub.
- Uses the existing unified nav for Back to Crew Hub, so the page no longer duplicates that control.

No Firebase/Auth/Firestore/rules changes are required.
