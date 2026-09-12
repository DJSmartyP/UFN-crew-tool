# FINAL player crew-plan watermark fix

Replace:
- admin-separation.js
- router.js

Add:
- campaign-player-plan-final.css

This fixes the two conflicting behaviours visible in the screenshot:

1. The same JS module was first setting the player plan title to "Current crew plan",
   then later changing EVERY `.ship-title` back to the crew name.
   Mirrored player plan cards now remain "Current crew plan", matching organiser view.

2. Older campaign alignment styling could still leave/reintroduce the explicit
   bottom-right campaign patch treatment.
   The final layer now:
   - removes any `.campaign-crew-plan-patch` image from player plans
   - removes `has-campaign-plan-patch`
   - cancels its reserved footer space
   - force-overrides the base `.ship-card::after` UFN watermark
   - uses the uploaded campaign patch as the ONLY plan watermark

The campaign patch still remains in the player title/banner.

No Firebase/Auth/Firestore/rules changes are required.
