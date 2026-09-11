# UFN campaign patch: Firestore-only update

This update removes the Firebase Storage dependency completely.

## Replace in GitHub

- `campaign-polish.js`
- `campaign-admin-polish.js`
- `campaign.css` (included so this delta also retains the bottom-right patch artwork on campaign deployment cards)

No `storage.rules` file is needed and Firebase Storage does **not** need to be enabled.

## How patches are stored

When a campaign crew or admin chooses a PNG/JPG/WebP image, the browser:

1. opens it locally;
2. scales it down to a maximum edge of 256 px;
3. compresses it to WebP;
4. keeps the final data well below the Firestore document limit;
5. stores that small data URL in the existing `patchUrl` field on the campaign crew document.

The original full-size image is never uploaded.

## Firebase rules

If you already published the Firestore rules from the earlier Admin Hub / Archive / Crew Patch update, **do not change them**. Those rules already allow an authenticated campaign crew to update its own `patchUrl` field.

If you never published those earlier Firestore rules, publish the `firestore.rules` from that earlier update first. This small delta does not otherwise require a rules change.

## What remains unchanged

- Admin hub bypasses the campaign password.
- Archive behaviour remains in place.
- Player registration/assignment logic is untouched.
- Campaign patches still appear on campaign pages, player pages and in the bottom-right of campaign deployment cards.
