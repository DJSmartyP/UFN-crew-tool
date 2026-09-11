# UFN Campaign Crew Directory + Separation Update

## GitHub files

Replace:
- `router.js`
- `campaign.js`
- `campaign-admin.js`
- `campaign.css`

Add:
- `campaign-directory.js`
- `admin-separation.js`

`index.html` does not need changing if it already loads `campaign.css` and `router.js`.

## Firebase

The included `firestore.rules` is based on the player-registration hotfix you just applied. It adds the sanitised public campaign directory without removing the player registration fix.

In Firebase project `bc-crew-autoassigner`:
1. Open Firestore Database -> Rules.
2. Replace the complete rules with this `firestore.rules`.
3. Publish.

## Then

Open the master admin and visit **Campaign crews** once. That page mirrors the existing crew names/statuses into the public directory.

Shared campaign entry page:
`https://djsmartyp.github.io/UFN-crew-tool/?campaign=1`

## Behaviour

- Normal admin **Deployments** shows standalone deployments only.
- Campaign deployments stay under **Campaign crews**.
- Each campaign crew is an expandable row; deployments appear only when opened.
- Campaign members use one shared crew-selection page, choose their crew, then enter the crew password.
- Campaign deployment setup has no ship-name control and no two-ship controls.
- Campaign deployments remain one crew / six players.
- Custom deployment player links remain supported.
- Player pages show **Campaign Crew Deployment** and the campaign crew name.
- The two-ship guidance line is removed from campaign player pages.
- Deployment cards have fixed responsive sizing: 3 across on normal landscape, 4 on wide screens, 2 on smaller screens, 1 on phones.
