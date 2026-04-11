# Security Policy

## Supported setup

This repository is intended to be self-hosted by operators who understand the trust model of Komari and related node execution.

## Security principles

- Never hardcode production passwords, tokens, or private server IPs in the repository.
- Prefer environment variables for all credentials and connection targets.
- Keep write actions authenticated.
- Treat node-side execution as sensitive and restrict it to fixed scripts or controlled workflows.
- Review public endpoints before exposing them to the internet.

## Before publishing your own fork

Checklist:

- remove real passwords and API keys
- remove real production IPs and domains unless intentionally public
- remove deployment workflows tied to private infrastructure
- review screenshots, logos, and branding assets
- confirm that public result APIs do not leak sensitive node details

## Reporting

If you discover a security issue in this project, please report it privately to the repository maintainer before opening a public issue.
