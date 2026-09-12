# Campaign patch placement + Crew Access card alignment

Replace:
- router.js
- campaign-directory.js
- admin-separation.js
- campaign-polish.js
- patch-lightbox.js

Add:
- campaign-card-alignment.css

What changes:
1. Crew Access directory cards
   - Every card now has the same fixed text-and-patch layout.
   - A reserved patch slot exists even when a crew has no patch.
   - Crew label, name, description and button therefore line up across every card.
   - No patch can push the text down.

2. Crew plan patch placement
   - For campaign deployments, the crew patch moves to the bottom-right of the actual crew plan.
   - The plan reserves space below the six station rows so the patch never covers a station.
   - The patch is used on player crew plans and campaign management crew plans where available.
   - The campaign player banner no longer duplicates the patch.

3. Patch lightbox
   - The bottom-right crew-plan patch remains clickable and expands using the existing large patch view.

No Firebase/Auth/Firestore/rules changes are required.
