# UFN short-crew planner update

Replace:
- router.js
- campaign.css

Add:
- short-crew-planner.js

No Firebase/Auth/Firestore rule changes are required.

Behaviour:
- 6 players: normal one-player-per-station plan.
- 5 players: Captain always takes one additional station. The optimiser chooses which extra station gives the best overall preference match.
- 4 players: Helm + Weapons are always the same player, and Captain also takes one of Engineering / Science / Relay. The optimiser chooses the best Captain extra station.
- 3 or fewer players: existing one-player-per-station behaviour remains; no extra combined-role rules are invented.
- Two-ship deployments preserve the existing planner's ship allocation first, then apply the 4/5-player rule independently to any ship that ends up with 4 or 5 crew.

The new layer changes only computed/displayed crew assignments. It does not alter player records, deployment records, registration transactions, authentication or Firestore rules.

The organiser/player roster identifies combined stations clearly. The crew PDF is intercepted only when a short-crew rule is active so the PDF reflects the same combined assignments.
