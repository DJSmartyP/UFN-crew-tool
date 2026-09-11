# UFN Crew Tool — Campaign Crew Update

This delta adds shared campaign-crew planners without changing the existing master-admin or player deployment flows.

## Files in this update

Replace:
- `index.html`
- `firestore.rules`

Add:
- `router.js`
- `campaign.js`
- `campaign-admin.js`
- `campaign.css`

Keep your existing `app.js`, `styles.css`, `firebase-config.js`, assets, privacy page and terms page unchanged.

## 1. Upload the GitHub files

Copy the files above into the root of `DJSmartyP/UFN-crew-tool` and commit them to `main`.

GitHub Pages will continue to serve the existing site. `router.js` sends:

- normal root/admin and `?m=...` player links to the existing `app.js`
- `?campaigns=1` to the master Campaign Crews admin screen
- `?crew=your-custom-name` to that crew's password-protected mini planner

The normal admin dashboard automatically gets a **Campaign crews** button after these files are live.

## 2. Enable Email/Password in Firebase Authentication

Firebase Console → Authentication → Sign-in method:

- Keep **Google** enabled (master administrator)
- Keep **Anonymous** enabled (deployment players)
- Enable **Email/Password** (campaign crew shared-password authentication)

You do NOT need Email Link/passwordless sign-in.

The code creates an internal random email account for each campaign. Crew members never see or use that email; they only use their custom campaign link and shared password.

## 3. Publish the Firestore rules

Firebase Console → Firestore Database → Rules.

Replace the rules with the supplied `firestore.rules`, then click **Publish**.

Do this before testing campaign creation. The new rules:

- preserve the existing main IDP rules
- preserve existing UFN admin-only deployments
- allow anonymous players to open a direct `?m=...` deployment and respond
- prevent anonymous players from listing all deployments
- restrict campaign organisers to deployments carrying their own `campaignCrew` slug
- prevent one campaign account from managing another campaign
- allow public lookup of a known campaign slug only so the password screen can locate its Firebase Auth account

## 4. Create the first campaign crew

Open the normal UFN administrator page and sign in with Google.

Click **Campaign crews** → **Create campaign crew**.

Set:
- Crew name, e.g. `Celeste Campaign Crew`
- Custom link name, e.g. `celeste`
- Shared password

The password field starts with `sxpgames` as requested. The app warns before creating a campaign with that default because it is easy to guess.

The resulting campaign URL will look like:

`https://djsmartyp.github.io/UFN-crew-tool/?crew=celeste`

Anyone with the URL still needs the shared campaign password.

## Password security

### What is secure in this build

The campaign password is **not stored in Firestore, localStorage, GitHub, or the JavaScript source**. Firebase Authentication receives it over HTTPS and stores/verifies it using Firebase's managed password authentication.

Firestore only stores:
- the campaign name/slug
- a random internal Firebase Auth email
- the Firebase Auth UID currently authorised for that campaign
- an incrementing password version

Knowing the Firestore document or internal email does not grant campaign access.

### Changing a password

A campaign can change its own password from **Campaign settings**. The master administrator can also use **Set new password** from Campaign Crews.

Password changes create a fresh Firebase Auth identity and move the campaign's Firestore authority to the new UID. Old signed-in campaign browsers therefore lose Firestore access immediately and must use the new password.

Admin-forced rotations may leave the previous Firebase Auth account as an unused orphan account. It has no Firestore rights after rotation. This is harmless from an access-control perspective; deleting old Auth users automatically would require a trusted backend/Admin SDK, which this GitHub Pages-only build deliberately does not add.

### Recommended passwords

Do not use `sxpgames` for a campaign that needs meaningful protection. It is only a convenient initial default.

Use a unique shared password of at least 12 characters. A short multi-word passphrase is easier to share, for example a structure such as `nebula-river-47-vanguard` (do not reuse that example literally).

Treat the campaign URL and password as two separate pieces of information where practical.

## Firebase/GitHub secrets note

`firebase-config.js` remains client-side. Firebase web API keys are identifiers, not administrator passwords. Do not put service-account JSON, Firebase Admin SDK private keys, GitHub tokens or other server credentials in this repository.

The actual data boundary is enforced by the supplied Firestore rules and Firebase Authentication.

## Optional hardening

For a small private gaming group, the supplied setup is appropriate. If the system becomes public or high-volume, consider enabling Firebase App Check for the web app to reduce automated abuse of Firebase endpoints.

## Quick test checklist

1. Existing root admin still signs in with Google.
2. Existing `?m=...` player links still open and anonymous players can register.
3. Admin → Campaign crews loads.
4. Create `Test Crew` with slug `test-crew` and a non-default password.
5. Open `?crew=test-crew` in a private/incognito browser.
6. Wrong password is rejected.
7. Correct password opens only Test Crew deployments.
8. Create a deployment and copy its player link.
9. Open the player link in another private browser and submit preferences.
10. Confirm the campaign dashboard receives the response and can manage locks.
11. Change the Test Crew password.
12. Confirm an old campaign tab can no longer read/write campaign Firestore data after refresh/action, while the new password works.
