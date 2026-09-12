# Player save reliability fix

Replace:
- router.js
- short-crew-planner.js
- campaign-polish.js

Add:
- player-save-polish.js
- player-save-polish.css

Why:
- The live repo was still loading the old short-crew planner with a whole-document MutationObserver feedback loop.
- That could monopolise the page during player registration and make Firestore saves appear to hang.
- The base app's success message was also immediately destroyed by its own rerender, so even a successful write could look like it had failed.

What changes:
- Installs the scoped/throttled short-crew observer fix.
- Installs the scoped/throttled campaign polish observer fix.
- Adds a save-in-progress state to the player form.
- Adds a persistent success banner after Firestore's player snapshot confirms the saved player record.
- Cache-busts the affected modules.

No Firestore rules changes are required: the current rules already permit an authenticated anonymous player to create/update their own UFN player record and name claim.
