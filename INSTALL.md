# Click-to-expand campaign patch

Replace:
- router.js

Add:
- patch-lightbox.js
- patch-lightbox.css

No Firebase, Auth, Firestore or rules changes are required.

Behaviour:
- Campaign/team patches become clickable anywhere they are shown.
- Clicking opens a large lightbox view of the patch.
- The campaign crew/team name is displayed beneath the patch.
- Click outside, press X or press Escape to close.
- Keyboard users can focus a patch and press Enter/Space.
- Works on crew hubs, campaign directory cards, admin crew pages, deployment views and patch previews.

This is deliberately implemented as one shared module so individual screen renderers do not need to be modified.
