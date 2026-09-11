# Campaign deployment-card patch artwork

Replace these GitHub files with the versions in this update:

- `campaign-polish.js`
- `campaign-admin-polish.js`
- `campaign.css`

No Firebase rules, Storage rules, authentication or database changes are required.

What changes:
- If a campaign crew has uploaded a patch, it appears as small artwork in the bottom-right of each campaign deployment tile.
- The same treatment is used in the campaign crew hub and the admin campaign hub.
- If no patch exists, nothing is rendered and there is no empty placeholder.
- Existing card sizes and wrapping behaviour are preserved.
