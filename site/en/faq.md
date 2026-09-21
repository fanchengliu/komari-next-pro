# FAQ

## Why does the footer still show komari-ds?

Install the latest theme package and force-refresh the browser. An older theme or Service Worker may still be cached. The internal theme ID stays `komari-ds`; the public footer is Komari Next Pro.

## Why is an IP probe only partially complete?

IPv4, IPv6 and quality lookups have separate results. Successful data is retained when another part fails. DNS failures, timeouts, rate limits and missing configuration are reported explicitly.

## Are IP reference scores actual reputation measurements?

No. They are documented deterministic heuristics based on metadata and network classification. Unknown fields do not create evidence. Actual provider flags remain in a separate view.

## Does a successful HTTP response prove streaming unlock?

No. Accounts, subscriptions, regions and individual content may have additional restrictions. The panel preserves response evidence rather than declaring every HTTP 200 fully unlocked.

## What does a red GitHub deployment mean?

That hosting deployment failed. Its status is separate from unit tests or a successful theme Release. Check the deployment logs, project root, build command and output directory. Old failure records remain historical records.

## Can I deploy the monitoring theme itself as the project website?

This repository's Vercel entry builds the documentation website. Install the monitoring theme inside Komari so its API requests have the correct backend. The documentation site does not access production monitoring data.
