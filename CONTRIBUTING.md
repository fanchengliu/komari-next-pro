# Contributing

Use Node.js 24.15+ on the 24 or 26 release line. Run `npm ci --ignore-scripts`, `npm test`, `npm run build`, and the relevant Playwright scenarios before opening a PR.

Keep changes focused and explain the visible behavior. Use synthetic nodes and documentation IP addresses in tests and screenshots. Do not attach production databases, credentials, private IP inventories or unredacted task results.

Preserve the separation between measured data, inferred data and unknown results. Keep mutation and probe actions explicit, authenticated and scoped to the selected node. Changes to theme IDs, storage keys or routes need a migration path.

Translations are maintained locally. After updating dictionaries run `npm run locales`. Include source/permission notes for new assets and retain existing license notices.
