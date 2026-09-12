# Emergency player-page freeze fix

Replace:
- admin-separation.js
- router.js

Root cause:
- The campaign player-page observer watched #main.
- Its apply() function then changed #main every time it ran:
  - deployment-factions.innerHTML was cleared unconditionally
  - ship-title.textContent was assigned unconditionally
- Those DOM writes triggered the observer again, creating a continuous loop.

Fix:
- Every DOM mutation is now conditional and only happens if something actually needs changing.
- The observer callback is throttled through requestAnimationFrame.
- Campaign patch still appears bottom-right on the crew plan.
- Campaign crew name still replaces the generic ship title.
- Two-ship campaign wording is still removed.
- The router has a new cache-bust so the looping module is not served from cache.

No Firebase/Auth/Firestore/rules changes are required.
