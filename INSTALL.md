# Campaign player plan mirror + campaign watermark

Replace:
- admin-separation.js
- router.js

Add:
- campaign-player-plan-mirror.css

What this changes:
- The campaign player screen's Current Crew Plan now mirrors the organiser layout.
- The generic faction badge is removed from the campaign player plan header.
- Header becomes:
  Campaign crew
  Current crew plan
  LIVE CREW VIEW
- All six station rows remain visible.
- Existing 4/5-player combined-role notes remain intact.
- If a campaign patch exists, it REPLACES the built-in UFN watermark inside the crew plan card.
- The explicit patch badge remains in the bottom-right of the crew plan as requested.
- The campaign patch remains in the player title bar too.
- No-patch campaigns fall back to the normal UFN watermark behaviour.

Stability:
- Based on the freeze-safe player observer.
- DOM writes remain conditional.
- Observer remains requestAnimationFrame-throttled.

No Firebase/Auth/Firestore/rules changes are required.
