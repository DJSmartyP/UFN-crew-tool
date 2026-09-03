# UFN Crew Deployment — Interstellar Deployment Planner

A UFN-themed variant of Interstellar Deployment Planner for EmptyEpsilon games.

## Crew model

- One ship: UFN only, maximum 6 players.
- Two ships: UFN + Ghosts, maximum 12 players.
- Fixed stations on each ship: Captain, Helm, Weapons, Engineering, Science, Relay.
- Players rank three station preferences or choose **No preference / fill a gap**.
- On two-ship deployments players can optionally prefer the UFN or Ghost crew.
- The organiser can independently lock a player to a ship, a station, or both.
- Crew assignment is recalculated globally as responses change.

## Organiser access

This build uses the same Firebase project/config as the main Interstellar Deployment Planner, but stores its data in a separate `ufnDeployments` collection. Only the configured `ADMIN_UID` can create/manage UFN deployments.

## GitHub Pages

Upload the contents of this folder to the root of a GitHub repository and enable GitHub Pages from the `main` branch.

Before the app will work, publish the included `firestore.rules` in Firebase Console. These rules preserve the existing Interstellar Deployment Planner rules and add the UFN collection.

Firebase Authentication must have:

- Google provider enabled (organiser)
- Anonymous provider enabled (players)
- your GitHub Pages domain listed as an authorised domain

No Cloud Functions are used and this build does not require the Blaze plan.


## Co-branded visual build
This version presents Interstellar Deployment Planner as the service provider and the United Federated Navy as the client. The organiser login is intentionally hidden under Administrator access on the public landing page.


## Direct player access
Players are expected to use deployment-specific links (`?m=...`) and therefore bypass the root screen entirely. The root URL is now a compact administrator-only Google sign-in entry point.

## Visual asset integration
This build includes:
- `assets/idp-fleet-hero.webp` – artwork crop from the approved IDP co-brand concept
- `assets/ufn-faction.webp` – UFN ship/faction badge from supplied art
- `assets/ghost-faction.webp` – Ghost ship/faction badge from supplied art

Faction artwork is used in the live ship roster and in deployment headers. IDP remains the service brand; UFN/Ghosts are the operational crews.

## Faction identity tiles
The previously-approved full faction artwork is now included as:
- `assets/ufn-faction-tile.webp` — UFN with “DISCIPLINE • HONOUR • VICTORY”
- `assets/ghost-faction-tile.webp` — Ghosts with “ADAPT • INFILTRATE • DESTROY”

These appear prominently in desktop ship panels. Compact round insignia remain in use on smaller/mobile layouts.
