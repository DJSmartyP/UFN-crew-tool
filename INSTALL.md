# Shared campaign crew-plan watermark fix

Replace:
- router.js
- campaign-polish.js
- campaign-admin-polish.js
- admin-separation.js

Add:
- campaign-plan-watermark.css

Why organiser/admin did not match player:
- The watermark image layer existed in all three code paths.
- But the styling that made it a faded watermark was bundled into admin-only / player-only CSS.
- The organiser route therefore did not load the same watermark presentation.
- Master admin also depended on route-specific CSS ordering.

This update loads ONE shared watermark stylesheet on every route.

Result:
- Player campaign crew plan: campaign patch watermark.
- Campaign organiser crew plan: same campaign patch watermark.
- Master admin direct deployment crew plan: same campaign patch watermark.
- Default UFN pseudo-watermark is suppressed whenever a campaign patch exists.
- No separate bottom-right patch badge.
- Title-bar patch remains unchanged.

No Firebase/Auth/Firestore/rules changes are required.
