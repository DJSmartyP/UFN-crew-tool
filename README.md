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
