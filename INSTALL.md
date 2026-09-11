# UFN Crew Tool – Admin hub / archive / campaign patch update

This delta is based on the current campaign-directory build. It deliberately leaves `app.js` and `campaign.js` untouched and adds the new behaviour through small companion modules where possible.

## GitHub

Replace these existing files:
- `router.js`
- `campaign-admin.js`
- `campaign-directory.js`
- `admin-separation.js`
- `campaign.css`

Add these new files:
- `campaign-polish.js`
- `campaign-admin-polish.js`
- `archive-admin.js`

Do **not** replace `app.js` or `campaign.js`.

## Firestore rules

In Firebase project `bc-crew-autoassigner`:

1. Open **Firestore Database → Rules**.
2. Replace the complete rules with the included `firestore.rules`.
3. Publish.

The only new campaign permission is the ability for the authenticated campaign account to update its own `patchUrl` / patch timestamp fields. Existing player-registration rules are retained.

## Firebase Storage – crew patch uploads

1. Open **Storage** in the same Firebase project. If Storage has never been enabled, click **Get started** and create the default bucket.
2. Open **Storage → Rules**.
3. Replace the Storage rules with the included `storage.rules` and publish.
4. The first time Storage rules use Firestore lookups, Firebase may prompt to enable the cross-product rules permission. Accept that prompt.

Uploads are restricted to the master admin or the authenticated campaign crew, to PNG/JPG/WebP files, max 2 MB. Patch files are publicly readable because they are displayed on player-facing pages.

## What changes

- Master admin **Open admin hub** no longer asks for the crew password.
- Admin can rename/archive a campaign crew and edit/archive its deployments directly.
- Destructive deployment deletion is replaced by fast **Archive** actions. This avoids the previous nested-delete operation that could leave the page waiting.
- A simple **Archive** page lists archived crews and deployments and allows Restore.
- Standalone admin deployments also use Archive instead of permanent delete.
- Campaign **Lock planner** is removed.
- Campaign crews can upload/replace/remove their own patch from Campaign settings.
- Admin can upload/replace/remove the patch from the admin crew hub.
- The patch is shown on campaign access/player/deployment pages. If no patch exists, the old empty graphic area is hidden.
- Copy buttons get brief `Copied ✓` feedback, campaign cards get response progress bars, and new campaign deployments default to today's date.

## Quick test

1. Open the normal admin page and confirm it loads without hanging.
2. Open **Campaign crews → Open admin hub**. It should open immediately with the Google admin session and **no campaign password**.
3. Archive a test deployment. It should disappear immediately rather than deleting nested player records.
4. Open **Archive**, confirm the deployment is listed, then Restore it.
5. In a campaign hub open **Campaign settings**, upload a small PNG/JPG/WebP patch, then open one of that campaign's player links and confirm the patch appears in the banner.
