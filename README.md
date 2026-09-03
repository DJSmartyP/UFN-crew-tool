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


## September 2026 UFN update
- Multiple players can register from the same browser/device using separate anonymous Firebase identities.
- Choosing No preference / fill a gap automatically fills remaining ranked choices.
- Default ship names: UFN Vanguard for one ship; UFN Celeste + GST Darkwater for two ships. All remain editable.
- One-ship roster expands across the available plan area.
- Faction poster artwork is retained as a subtle card texture; compact faction insignia are used for primary identification.
- New clean PNG assets: `assets/site-background.png` and `assets/bar-background.png`.
- `firestore.rules` is the corrected combined ruleset preserving both the main IDP and UFN systems.


## September layout refinement
- Full approved UFN/Ghost identity tiles now sit above each ship crew box.
- Duplicate faction artwork at the top edge of ship boxes has been removed; the subtle lower-right watermark remains.
- Deployment name/date now live inside the branded deployment bar.
- Admin can permanently delete deployments, including their players and name claims, after two-step confirmation.
- No Firestore rules change is required; existing admin delete permissions already cover this operation.


## Crew PDF export
The organiser crew-management screen now includes **Download crew PDF**.

- One A4 landscape page per deployment.
- A single-ship deployment uses the full page width.
- A two-ship deployment places UFN and Ghost crews side-by-side on the same page.
- All six bridge stations are always shown.
- Empty stations are shown as `To be decided`.
- Uses the IDP masthead and the appropriate UFN/Ghost faction insignia.
- The PDF contains assignments only; player preference/dislike data is not included.


## Final faction-card refinement
- Full UFN/Ghost poster tiles have been removed from the live ship cards.
- Compact faction insignia remain in the ship header.
- The subtle faction logo watermark remains at the bottom-right of each ship card.
- The deployment/mission-details bar uses `assets/bar-background.png` as its dedicated background artwork.
- PDF export uses compact faction logos rather than the poster tiles.


## Masthead and deployment-bar refinement
- Organiser badge and sign-out controls are now outside the masthead.
- Player pages have no empty utility row.
- The masthead is materially shorter.
- The existing `assets/bar-background.png` is now deliberately visible behind deployment name/date details rather than being hidden by a heavy dark overlay.


## Organiser-added players
The organiser can now add players directly from **Manage crew → Responses → Add player**.

- New organiser-added players default to `No preference / fill a gap`.
- The organiser can enter ship preference, station preferences, dislikes and optional hard ship/station locks.
- Capacity limits remain 6 for one ship and 12 for two ships.
- Duplicate-name protection still applies.
- Organiser-added players immediately participate in the live allocation and PDF export.
- No Firestore rules change is required for this feature; the existing shared rules file is unchanged.
