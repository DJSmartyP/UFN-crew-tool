# Campaign watermark patch update

Replace:
- router.js

Add:
- campaign-watermark.js
- campaign-watermark.css

What this changes:
- On campaign-specific pages, the faded UFN watermark is automatically replaced with the crew's uploaded patch.
- If that crew has no patch, the standard UFN watermark remains.
- This works for:
  - campaign password/access pages for a selected crew
  - campaign crew hubs
  - player campaign deployment pages
  - admin crew hub pages
  - direct admin deployment pages

Implementation notes:
- The module looks for the active campaign patch already shown on the page and mirrors it into `.ufn-mark img`.
- It observes `#main` and `#topActions` only, throttled through requestAnimationFrame, so it should not introduce another page-freeze loop.

No Firebase/Auth/Firestore/rules changes are required.
