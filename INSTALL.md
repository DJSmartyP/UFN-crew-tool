# Restore player edit controls at admin level

Replace:
- campaign-admin-polish.js
- admin-direct-deployment.css
- router.js

Campaign organiser level:
- The existing campaign organiser deployment manager already retains:
  - Add player
  - Edit player
  - Delete player
  - station lock
  - preference editing

Master admin direct deployment page:
- Restores direct controls for every registered player:
  - Edit player
  - Edit 1st / 2nd / 3rd preferences
  - Edit "Really don't want"
  - Set / clear station lock
  - Rename player with duplicate-name protection
  - Delete player
- Shows the current station lock directly in the response row.
- Player deletion also removes their name claim, organiser override and decrements responseCount.
- Saving stays on the direct deployment page.

This router is based on the latest player freeze/watermark chain so it does not regress those fixes.

No Firestore rules changes are required; master admin already has write/delete permission.
