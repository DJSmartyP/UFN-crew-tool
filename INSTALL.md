# UFN navigation + admin campaign deployment update

Replace:
- router.js
- admin-separation.js
- campaign.css

Add:
- navigation-polish.js
- campaign-admin-create.js

No Firebase rule changes are required.

Changes:
- Consistent admin navigation: Deployments / Campaign crews / Crew access / Archive / Sign out.
- Clear back navigation on campaign hubs and deployment management screens.
- Campaign player pages now have a back link to the crew hub.
- Campaign patch replaces the generic UFN roundel on campaign player deployment banners when a patch exists.
- The generic UFN roundel remains as the fallback when no patch exists.
- UFN admin can create campaign deployments directly from an admin crew hub, including deployment name, date and custom player link.
