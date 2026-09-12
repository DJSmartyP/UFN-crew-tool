# Player title-bar campaign patch

Replace:
- admin-separation.js
- router.js

What changes:
- On campaign player deployment pages, the uploaded crew patch now appears in the title/banner area, matching the organiser treatment.
- The same patch remains bottom-right on the crew plan.
- If no crew patch exists, the normal UFN title-bar treatment remains.
- All DOM writes are conditional, preserving the player-page freeze fix.

No Firebase/Auth/Firestore/rules changes are required.
