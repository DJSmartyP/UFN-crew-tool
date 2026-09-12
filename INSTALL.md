# Campaign Add Player hang / user-side stability fix

Replace:
- campaign-polish.js
- short-crew-planner.js
- router.js

No CSS, Firebase, Auth, Firestore data or rules changes are required.

Root cause:
- short-crew-planner.js observed the entire document.
- On every mutation it unconditionally rewrote #responseStats.
- Rewriting #responseStats created another mutation.
- That created an observer feedback loop.
- Opening the Add Player modal added further page mutations and made the loop show up as a freeze/hang.
- campaign-polish.js also had a separate whole-document observer adding additional work.

Fix:
- Crew planner observer is now scoped to #main and throttled to one pass per animation frame.
- Identical response stats are no longer rewritten.
- Short-crew roster rendering uses a plan signature so it only replaces the roster when the underlying plan or base render actually changed.
- Campaign polish watches #main plus direct body children only, so opening/editing a modal does not create recursive polish passes.
- Both affected modules are cache-busted in router.js.

Also retained from the intended latest planner:
- 5-player Captain takes a second station.
- 4-player Helm + Weapons are combined and Captain takes a second station.
- Captain's next ranked station is strongly preferred for their additional role.
- Large campaign patch on the crew hub; no repeated patch on each hub deployment tile.
