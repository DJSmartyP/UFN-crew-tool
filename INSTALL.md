# Campaign player crew-plan patch: watermark only

Replace:
- admin-separation.js
- campaign-player-plan-mirror.css
- router.js

What changes:
- Removes the explicit bottom-right patch badge from the campaign player crew plan.
- Keeps the uploaded campaign patch as the crew-plan watermark.
- Keeps the patch in the player title/banner.
- Keeps the organiser-mirrored Current Crew Plan layout.
- Keeps all six station rows and short-crew combined-role notes.
- Preserves the freeze-safe conditional/throttled player-page observer.

No Firebase/Auth/Firestore/rules changes are required.
